/**
 * pi-recap: when you come back to an idle session, Haiku writes a 1-3 sentence recap
 * (what you wanted, where it stands, the next step), shown dim in the transcript.
 * Same idea as Claude Code's away recap.
 *
 * Away detection: terminal focus reporting (DECSET 1004; tmux needs `focus-events on`).
 * Focus lost for AWAY_MS, then regained, triggers a recap. Terminals that never send focus
 * events fall back to the first keypress after AWAY_MS without activity.
 *
 * The recap is a custom entry: shown, never sent to the main model. Only Haiku runs it.
 * `/recap` recaps now; `/recap off` and `/recap on` persist in ~/.pi/agent/recap.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { type ExtensionAPI, type ExtensionContext, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { CHILD_ENV } from "../lib/child-pi.ts";

const PROVIDER = "anthropic";
const MODEL_ID = "claude-haiku-5-5";
const AWAY_MS = 3 * 60_000;
const MAX_TRANSCRIPT_CHARS = 40_000;
const ENTRY_TYPE = "pi-recap";
const STATE_FILE = join(getAgentDir(), "recap.json");

const FOCUS_IN = "\x1b[I";
const FOCUS_OUT = "\x1b[O";

const SYSTEM_PROMPT = `You write a recap for a developer coming back to a coding-agent session after a break.
From the transcript, write 1-3 short sentences, at most 60 words, plain text, no markdown, addressed to the user as "you":
1. what the user wanted,
2. where it stands now (what is done, verified, blocked, or uncommitted),
3. the single next step, if one is clear, starting with "Next,".
Use only facts from the transcript. Write in the user's language. Output only the recap.`;

function loadEnabled(): boolean {
	try {
		return JSON.parse(readFileSync(STATE_FILE, "utf8")).enabled !== false;
	} catch {
		return true;
	}
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((c: { type?: string; text?: string; name?: string; arguments?: Record<string, unknown> }) => {
			if (c.type === "text") return c.text ?? "";
			if (c.type === "toolCall") {
				const target = c.arguments?.path ?? c.arguments?.command ?? c.arguments?.role ?? "";
				return `[${c.name}${target ? ` ${String(target).slice(0, 80)}` : ""}]`;
			}
			return "";
		})
		.filter(Boolean)
		.join("\n");
}

/** Compact transcript: user turns, assistant text and tool-call names, compaction summaries. Tool output is dropped. */
function buildTranscript(ctx: ExtensionContext): { text: string; turns: number } {
	const lines: string[] = [];
	let turns = 0;
	for (const entry of ctx.sessionManager.buildContextEntries()) {
		if (entry.type === "compaction") {
			lines.push(`EARLIER (summary): ${entry.summary}`);
		} else if (entry.type === "message") {
			const msg = entry.message as AgentMessage & { role: string; content?: unknown };
			if (msg.role === "user") {
				turns++;
				lines.push(`USER: ${textOf(msg.content)}`);
			} else if (msg.role === "assistant") {
				const t = textOf(msg.content);
				if (t) lines.push(`AGENT: ${t}`);
			}
		} else if (entry.type === "custom_message") {
			lines.push(`[${entry.customType}]: ${textOf(entry.content).slice(0, 2000)}`);
		}
	}
	const text = lines.join("\n");
	return { text: text.length > MAX_TRANSCRIPT_CHARS ? text.slice(-MAX_TRANSCRIPT_CHARS) : text, turns };
}

export default function (pi: ExtensionAPI) {
	if (process.env[CHILD_ENV]) return;

	let enabled = loadEnabled();
	let ctxRef: ExtensionContext | undefined;
	let blurredAt: number | undefined;
	let focusSeen = false;
	let lastActivity = Date.now();
	let recappedTurns = 0;
	let inFlight: AbortController | undefined;
	let unsubscribe: (() => void) | undefined;

	async function recap(ctx: ExtensionContext, force: boolean): Promise<void> {
		if (inFlight || !ctx.isIdle()) return;
		const { text, turns } = buildTranscript(ctx);
		if (turns === 0 || (!force && turns === recappedTurns)) return;
		// smaller model only: never fall back to the session's model
		const model = ctx.modelRegistry.find(PROVIDER, MODEL_ID);
		if (!model) {
			if (force) ctx.ui.notify(`pi-recap: ${PROVIDER}/${MODEL_ID} not available`, "warning");
			return;
		}
		inFlight = new AbortController();
		try {
			const reply = await ctx.modelRegistry.complete(
				model,
				{
					systemPrompt: SYSTEM_PROMPT,
					messages: [{ role: "user", content: `<transcript>\n${text}\n</transcript>`, timestamp: Date.now() }],
				},
				{ maxTokens: 2048, signal: inFlight.signal },
			);
			const out = textOf(reply.content.filter((c) => c.type === "text")).trim();
			if (reply.stopReason === "error" || !out) {
				if (force) ctx.ui.notify(`pi-recap: ${reply.errorMessage ?? "empty recap"}`, "warning");
				return;
			}
			recappedTurns = turns;
			pi.appendEntry(ENTRY_TYPE, { text: out });
		} catch (err) {
			if (force) ctx.ui.notify(`pi-recap: ${err instanceof Error ? err.message : String(err)}`, "warning");
		} finally {
			inFlight = undefined;
		}
	}

	pi.registerEntryRenderer<{ text: string }>(ENTRY_TYPE, (entry, _options, theme) =>
		entry.data
			? new Text(
					`${theme.fg("accent", "recap:")} ${theme.fg("dim", entry.data.text)} ${theme.fg("dim", "(/recap off to disable)")}`,
					1,
					0,
				)
			: undefined,
	);

	pi.on("session_start", (_event, ctx) => {
		ctxRef = ctx;
		recappedTurns = buildTranscript(ctx).turns; // a resumed session counts as already recapped
		if (ctx.mode !== "tui" || unsubscribe) return;
		process.stdout.write("\x1b[?1004h");
		unsubscribe = ctx.ui.onTerminalInput((data) => {
			const now = Date.now();
			if (data.includes(FOCUS_OUT) || data.includes(FOCUS_IN)) {
				focusSeen = true;
				if (data.includes(FOCUS_OUT)) blurredAt = now;
				if (data.includes(FOCUS_IN)) {
					if (enabled && ctxRef && blurredAt !== undefined && now - blurredAt >= AWAY_MS) void recap(ctxRef, false);
					blurredAt = undefined;
				}
				const rest = data.replaceAll(FOCUS_IN, "").replaceAll(FOCUS_OUT, "");
				return rest ? { data: rest } : { consume: true };
			}
			if (!focusSeen && enabled && ctxRef && now - lastActivity >= AWAY_MS) void recap(ctxRef, false);
			lastActivity = now;
			return undefined;
		});
	});

	pi.on("agent_settled", () => {
		lastActivity = Date.now();
	});

	pi.on("session_shutdown", () => {
		inFlight?.abort();
		if (unsubscribe) {
			unsubscribe();
			unsubscribe = undefined;
			process.stdout.write("\x1b[?1004l");
		}
	});

	pi.registerCommand("recap", {
		description: "Recap this session now; `/recap off` or `/recap on` toggles away recaps",
		handler: async (args, ctx) => {
			const arg = args.trim();
			if (arg === "on" || arg === "off") {
				enabled = arg === "on";
				writeFileSync(STATE_FILE, `${JSON.stringify({ enabled })}\n`);
				ctx.ui.notify(`recaps ${arg}`, "info");
				return;
			}
			await recap(ctx, true);
		},
	});
}
