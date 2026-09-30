/**
 * Minimal permission gate, built only on the public ExtensionAPI (pi.on("tool_call")).
 *
 * Policy (no prompts, so nothing ever waits on a dialog):
 * - Secure paths (keys, credentials, .env, …): always blocked, read or write.
 * - Reads: allowed anywhere.
 * - Writes (write / edit / mutating bash): allowed inside cwd, ~/.pi, and temp dirs;
 *   blocked everywhere else (read-only).
 */

import { existsSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, resolve, sep } from "node:path";
import type { ExtensionAPI, ExtensionContext, ToolCallEvent } from "@earendil-works/pi-coding-agent";

// Regex checks against the resolved absolute path. Never readable, never written.
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
	/(^|\/)\.pi\/agent\/(mcp-)?auth\.json$/,
];

// Tools whose `path` input is only read.
const READ_TOOLS = new Set(["read", "grep", "find", "ls"]);

// Every non-flag arg is written/deleted.
const ALL_ARGS_VERBS = new Set(["rm", "rmdir", "unlink", "touch", "mkdir", "truncate", "tee", "chmod", "chown", "mv"]);
// Only the last non-flag arg (destination) is written.
const DEST_VERBS = new Set(["cp", "rsync", "install", "ln"]);

function realOrSelf(p: string): string {
	try {
		return existsSync(p) ? realpathSync(p) : p;
	} catch {
		return p;
	}
}

function resolvePath(p: string, cwd: string): string {
	const expanded = p === "~" ? homedir() : p.startsWith("~/") ? resolve(homedir(), p.slice(2)) : p;
	return realOrSelf(isAbsolute(expanded) ? expanded : resolve(cwd, expanded));
}

function isInside(p: string, root: string): boolean {
	return p === root || p.startsWith(root.endsWith(sep) ? root : root + sep);
}

function isSecurePath(resolved: string): boolean {
	return SECURE_PATTERNS.some((re) => re.test(resolved));
}

// ~/.pi is a stow symlink, so match both the link path and its real target.
function writableRoots(cwd: string): string[] {
	const piHome = resolve(homedir(), ".pi");
	const roots = [resolve(cwd), piHome, tmpdir(), "/tmp", "/dev/null"];
	return [...new Set([...roots, ...roots.map(realOrSelf)])];
}

function isWritable(resolved: string, cwd: string): boolean {
	return writableRoots(cwd).some((root) => isInside(resolved, root));
}

const unquote = (t: string) => t.replace(/^['"]|['"]$/g, "");

/**
 * Paths a bash command writes to: redirect targets, plus args of mutating verbs
 * (all args for rm/mv/touch/…, destination for cp/rsync/ln, files for sed -i,
 * search roots for find -delete/-exec, of= for dd). Tracks `cd` across segments.
 */
function extractWriteTargets(command: string, startCwd: string): string[] {
	const targets: string[] = [];
	let cwd = startCwd;
	for (const segment of command.split(/&&|\|\||;|\||\n/)) {
		const tokens = segment.trim().split(/\s+/).filter(Boolean);
		const args: string[] = [];
		for (let i = 0; i < tokens.length; i++) {
			const redirect = tokens[i].match(/^(?:\d*|&)(>>?|>\|)(&?)(.*)$/);
			if (redirect) {
				if (redirect[2]) continue; // 2>&1: fd dup, no file
				const target = redirect[3] || tokens[++i];
				if (target) targets.push(resolvePath(unquote(target), cwd));
				continue;
			}
			args.push(unquote(tokens[i]));
		}

		const verbAt = args.findIndex((t) => ALL_ARGS_VERBS.has(t) || DEST_VERBS.has(t) || t === "sed" || t === "find" || t === "dd" || t === "cd");
		if (verbAt === -1) continue;
		const verb = args[verbAt];
		const rest = args.slice(verbAt + 1);
		const operands = rest.filter((t) => !t.startsWith("-"));
		const push = (ps: string[]) => targets.push(...ps.map((p) => resolvePath(p, cwd)));

		if (verb === "cd") cwd = resolvePath(operands[0] ?? "~", cwd);
		else if (ALL_ARGS_VERBS.has(verb)) push(operands);
		else if (DEST_VERBS.has(verb)) push(operands.slice(-1));
		else if (verb === "sed" && rest.some((t) => /^-[a-zA-Z]*i/.test(t) || t.startsWith("--in-place"))) push(operands.slice(1));
		else if (verb === "find" && rest.some((t) => t === "-delete" || t === "-exec" || t === "-execdir")) {
			push(rest.slice(0, rest.findIndex((t) => t.startsWith("-"))));
		} else if (verb === "dd") push(rest.filter((t) => t.startsWith("of=")).map((t) => t.slice(3)));
	}
	return targets;
}

// Rough path-token extraction: whitespace-split, strip quotes and redirect prefixes (2>/dev/null), keep path-like tokens.
function extractPathTokens(command: string): string[] {
	return command
		.split(/\s+/)
		.map((t) => t.replace(/^\d*(>>?|<>?)&?/, "").replace(/^['"]|['"]$/g, ""))
		.filter((t) => t.length > 0 && !t.startsWith("-") && (t.includes("/") || t.startsWith("~")))
		.filter((t) => !/^https?:\/\//.test(t));
}

type Decision = { block: true; reason: string } | undefined;

function blockWrite(target: string): Decision {
	return { block: true, reason: `Read-only outside cwd, ~/.pi and temp dirs: ${target}` };
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event: ToolCallEvent, ctx: ExtensionContext): Decision => {
		const input = event.input as { path?: unknown; command?: unknown };

		if (READ_TOOLS.has(event.toolName)) {
			if (typeof input.path !== "string") return undefined;
			const resolved = resolvePath(input.path, ctx.cwd);
			return isSecurePath(resolved) ? { block: true, reason: `Refusing access to secure path: ${resolved}` } : undefined;
		}

		if (event.toolName === "write" || event.toolName === "edit") {
			if (typeof input.path !== "string") return undefined;
			const resolved = resolvePath(input.path, ctx.cwd);
			if (isSecurePath(resolved)) return { block: true, reason: `Refusing access to secure path: ${resolved}` };
			return isWritable(resolved, ctx.cwd) ? undefined : blockWrite(resolved);
		}

		if (event.toolName === "bash" && typeof input.command === "string") {
			const command = input.command;
			const resolvedTokens = extractPathTokens(command).map((t) => resolvePath(t, ctx.cwd));

			const securedHit = resolvedTokens.find(isSecurePath);
			if (securedHit) return { block: true, reason: `Refusing bash access to secure path: ${securedHit}` };

			// ponytail: parses direct verbs only; writes via bash -c, scripts, git -C, npm --prefix pass unchecked
			const outsideHit = extractWriteTargets(command, ctx.cwd).find((p) => !isWritable(p, ctx.cwd));
			return outsideHit ? blockWrite(outsideHit) : undefined;
		}

		return undefined;
	});
}
