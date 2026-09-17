/**
 * Minimal permission gate, built only on the public ExtensionAPI (pi.on("tool_call")).
 *
 * Policy:
 * - read: always allowed, except secure files (blocked outright).
 * - write / edit / delete (rm via bash): allowed inside cwd.
 * - write / edit / delete outside cwd: ask, with Once / This session / None(deny).
 * - bash commands are scanned for path tokens and gated the same way.
 */

import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve, sep } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
} from "@earendil-works/pi-coding-agent";

// Substring/regex checks against the resolved absolute path. Never readable, never silently written.
const SECURE_PATTERNS: RegExp[] = [
	/\.ssh(\/|$)/,
	/\.aws(\/|$)/,
	/\.gnupg(\/|$)/,
	/\.kube(\/|$)/,
	/\.docker\/config\.json$/,
	/(^|\/)\.env(\..*)?$/,
	/(^|\/)id_rsa\b/,
	/(^|\/)id_ed25519\b/,
	/\.pem$/,
	/\.p12$/,
	/\.key$/,
	/(^|\/)\.netrc$/,
	/(^|\/)\.npmrc$/,
	/(^|\/)credentials(\.json)?$/i,
	/(^|\/)secrets?\./i,
	/(^|\/)\.git-credentials$/,
];

// First word of a bash pipeline segment that mutates the filesystem.
const MUTATING_VERBS =
	/\b(rm|mv|cp|touch|mkdir|rmdir|unlink|truncate|tee|dd|ln|install|rsync|sed\s+-i|chmod|chown)\b/;
const REDIRECT_RE = />>?|<>/;

function expandHome(p: string): string {
	if (p === "~") return homedir();
	if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
	return p;
}

function resolvePath(p: string, cwd: string): string {
	const expanded = expandHome(p);
	const abs = isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
	try {
		return existsSync(abs) ? realpathSync(abs) : abs;
	} catch {
		return abs;
	}
}

function isOutsideCwd(resolved: string, cwd: string): boolean {
	const resolvedCwd = resolve(cwd);
	return resolved !== resolvedCwd && !resolved.startsWith(resolvedCwd + sep);
}

function isSecurePath(resolved: string): boolean {
	return SECURE_PATTERNS.some((re) => re.test(resolved));
}

// Rough path-token extraction from a shell command: whitespace-split, drop flags/operators/pure numbers.
function extractPathTokens(command: string): string[] {
	return command
		.split(/\s+/)
		.map((t) => t.replace(/^['"]|['"]$/g, ""))
		.filter(
			(t) =>
				t.length > 0 &&
				!t.startsWith("-") &&
				(t.includes("/") || t.startsWith("~")),
		)
		.filter((t) => !/^https?:\/\//.test(t));
}

export default function (pi: ExtensionAPI) {
	// Reset every session: "This session" approval only lasts the session.
	let sessionAllowOutsideCwd = false;

	pi.on("session_start", () => {
		sessionAllowOutsideCwd = false;
	});

	async function askOutsideCwd(
		ctx: ExtensionContext,
		description: string,
	): Promise<{ block?: boolean; reason?: string } | undefined> {
		if (sessionAllowOutsideCwd) return undefined;
		if (!ctx.hasUI) {
			return {
				block: true,
				reason: "Outside-cwd write blocked (no UI for confirmation)",
			};
		}
		const choice = await ctx.ui.select(
			`Outside working directory:\n\n  ${description}\n\nAllow?`,
			["Allow once", "Allow for this session", "Deny"],
		);
		if (choice === "Allow for this session") {
			sessionAllowOutsideCwd = true;
			return undefined;
		}
		if (choice === "Allow once") return undefined;
		return { block: true, reason: "Blocked by user (outside cwd)" };
	}

	pi.on("tool_call", async (event: ToolCallEvent, ctx: ExtensionContext) => {
		if (event.toolName === "read") {
			const resolved = resolvePath(event.input.path, ctx.cwd);
			if (isSecurePath(resolved)) {
				return { block: true, reason: `Refusing to read secure path: ${resolved}` };
			}
			return undefined;
		}

		if (event.toolName === "write" || event.toolName === "edit") {
			const resolved = resolvePath(event.input.path, ctx.cwd);
			if (isOutsideCwd(resolved, ctx.cwd)) {
				return askOutsideCwd(ctx, `${event.toolName} ${resolved}`);
			}
			return undefined;
		}

		if (event.toolName === "bash") {
			const command = event.input.command as string;
			const tokens = extractPathTokens(command);
			const resolvedTokens = tokens.map((t) => resolvePath(t, ctx.cwd));

			const securedHit = resolvedTokens.find((p) => isSecurePath(p));
			if (securedHit) {
				return {
					block: true,
					reason: `Refusing bash access to secure path: ${securedHit}`,
				};
			}

			const isMutating = MUTATING_VERBS.test(command) || REDIRECT_RE.test(command);
			if (!isMutating) return undefined;

			const outsideHit = resolvedTokens.find((p) => isOutsideCwd(p, ctx.cwd));
			if (outsideHit) {
				return askOutsideCwd(ctx, `bash: ${command}`);
			}
			return undefined;
		}

		return undefined;
	});
}
