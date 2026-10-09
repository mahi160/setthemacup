/**
 * pi-spawn: run a child `pi` process (RPC mode) for one focused task, isolated from
 * this session's history (extensions/packages stay on, matching the interactive
 * session, so OAuth/billing compat and other global extensions still apply), with
 * live progress feedback and a real ask-bridge.
 *
 * /spawn <task>      - free-form read-only investigation (fixed cheap model, restricted tools)
 * /commit /pr /pr-check /review /css-audit
 *                    - fixed git-workflow commands driven by commands.json (per-command
 *                      model/thinking, full tool access — see docs/adr/0001, 0002, 0004)
 *
 * Progress display:
 * - When the caller has UI (interactive or `--mode rpc`): a live status box, header line
 *   plus last 3 log lines, shown via ctx.ui.setWidget (a pi UI primitive — no custom
 *   terminal code).
 * - Otherwise (print/json mode, no UI to attach a widget to): falls back to a vertical
 *   tmux pane (when running inside tmux) that tails the child's progress and prints
 *   the final result.
 *
 * Ask-bridge: if the child needs to prompt the user (e.g. a project-trust decision, a
 * genuine ambiguity), its `extension_ui_request` is relayed back here. In box mode this
 * does NOT auto-pop a dialog — the widget marks the run "pending question" and waits;
 * pressing ctrl+shift+a opens the real prompt (ctx.ui.select/confirm/input) and resumes
 * the child. Same key, when nothing is pending, dumps the full run log into the transcript
 * (the widget itself is capped at 3 lines). In tmux mode (no UI to defer to) the ask is
 * relayed synchronously via `tmux command-prompt`, same as before.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	ExecOptions,
	ExecResult,
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionUIContext,
	Theme,
	ThemeColor,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

type ExecFn = (command: string, args: string[], options?: ExecOptions) => Promise<ExecResult>;

const DIR = dirname(fileURLToPath(import.meta.url));
const ANSWER_KEY_HINT = "ctrl+shift+a";
const LOG_ENTRY_TYPE = "pi-spawn-log";

const SPAWN_INSTRUCTIONS = `Read-only investigation task. Rules:
- Inspect only what is necessary to answer.
- Do not modify any files.
- Do not explain your process or steps taken.
- Return only a concise final result.
- Include relevant file paths and line numbers.
- If evidence is insufficient, say so explicitly instead of guessing.

Task: `;

// prompt .md files are passive numbered steps (docs, not directives) — without an
// imperative wrapper the child just describes the workflow instead of doing it.
const EXEC_PREAMBLE = `Execute the following instructions now, taking action with your tools. Do not just describe them or ask for confirmation unless the instructions say to.\n\n`;

const WIDGET_KEY = "pi-spawn";
const BODY_LINES = 3;
const LINE_WIDTH = 78;
const RESULT_MESSAGE_TYPE = "pi-spawn-result";
const SPINNER_FRAMES = ["⠳", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const SPINNER_TICK_MS = 100;

/** Readable one-liner for a tool call — bash command, file path, grep pattern, or bare name. */
function formatTool(name: string | undefined, args: Record<string, unknown> | undefined): string {
	if (!name) return "";
	const n = name.toLowerCase();
	if (!args) return n;
	if (n === "bash" && typeof args.command === "string") return `bash: ${args.command.slice(0, 60)}`;
	if ((n === "read" || n === "write" || n === "edit") && typeof args.path === "string") return `${n}: ${args.path}`;
	if (n === "grep" && typeof args.pattern === "string") return `grep: ${args.pattern}`;
	return n;
}

/** Bordered box, redrawn on every requestRender — ┌ title ┐ frame around wrapped body lines. */
function drawBox(title: string, body: string[], theme: Theme, borderColor: ThemeColor): Component {
	return {
		render(width: number): string[] {
			const innerWidth = Math.max(10, width - 4);
			const t = ` ${title} `;
			const topRule = "─".repeat(Math.max(0, innerWidth + 2 - visibleWidth(t)));
			const lines: string[] = [theme.fg(borderColor, `┌${t}${topRule}┐`)];
			for (const raw of body) {
				for (const wrapped of wrapTextWithAnsi(raw, innerWidth) || [""]) {
					const pad = " ".repeat(Math.max(0, innerWidth - visibleWidth(wrapped)));
					lines.push(`${theme.fg(borderColor, "│")} ${wrapped}${pad} ${theme.fg(borderColor, "│")}`);
				}
			}
			lines.push(theme.fg(borderColor, `└${"─".repeat(innerWidth + 2)}┘`));
			return lines;
		},
		invalidate() {},
	};
}

interface ResultDetails {
	header: string;
	output: string;
	error?: string;
}

/** Deliver the finished run to the master session: a real message (LLM context + transcript), not a toast. */
function sendResult(pi: ExtensionAPI, header: string, text: string, error: string | undefined): void {
	const body = error ?? text ?? "(no output)";
	pi.sendMessage<ResultDetails>(
		{
			customType: RESULT_MESSAGE_TYPE,
			content: `${header}${error ? " failed" : ""}:\n\n${body}`,
			display: true,
			details: { header, output: text, error },
		},
		{ triggerTurn: true },
	);
}

interface CommandEntry {
	name: string;
	model: string;
	thinking: string;
	prompt: string;
}

let REGISTRY: CommandEntry[];
try {
	REGISTRY = JSON.parse(readFileSync(join(DIR, "commands.json"), "utf8"));
} catch (err) {
	throw new Error(`pi-spawn: failed to load commands.json: ${err instanceof Error ? err.message : String(err)}`);
}

function truncate(s: string, n: number): string {
	const flat = s.replace(/\s+/g, " ").trim();
	return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

interface AskRequest {
	id: string;
	method: string;
	title?: string;
	message?: string;
	options?: string[];
	placeholder?: string;
	prefill?: string;
}

interface AskAnswer {
	value?: string;
	confirmed?: boolean;
	cancelled?: boolean;
}

/** One run in flight (box mode). Several can run at once, each with its own widget. */
interface ActiveRun {
	id: string;
	header: string;
	abort: AbortController;
	log: string[];
	currentTool: string;
	streamText: string[];
	frame: number;
	startedAt: number;
	tui?: TUI;
	pending?: { req: AskRequest; resolve: (a: AskAnswer) => void };
	render: () => void;
}

const runs = new Map<string, ActiveRun>();

function runLabel(run: ActiveRun): string {
	const secs = ((Date.now() - run.startedAt) / 1000).toFixed(0);
	const status = run.pending ? "❓ waiting" : run.currentTool ? `⟳ ${run.currentTool}` : "running";
	return truncate(`[${run.id}] ${run.header} · ${secs}s · ${status}`, 120);
}

/** Pick one run (skips the dialog when only one exists). */
async function pickRun(ui: ExtensionUIContext, title: string): Promise<ActiveRun | undefined> {
	const list = [...runs.values()];
	if (list.length <= 1) return list[0];
	const labels = list.map(runLabel);
	const choice = await ui.select(title, labels);
	return choice === undefined ? undefined : list[labels.indexOf(choice)];
}

/** JSONL framing per docs: split on \n only, tolerate trailing \r. */
function attachJsonlReader(stream: NodeJS.ReadableStream, onLine: (line: string) => void): void {
	let buffer = "";
	stream.on("data", (chunk: Buffer) => {
		buffer += chunk.toString("utf8");
		let idx = buffer.indexOf("\n");
		while (idx !== -1) {
			let line = buffer.slice(0, idx);
			buffer = buffer.slice(idx + 1);
			if (line.endsWith("\r")) line = line.slice(0, -1);
			if (line) onLine(line);
			idx = buffer.indexOf("\n");
		}
	});
}

interface RunOptions {
	task: string;
	cwd: string;
	model: string;
	thinking: string;
	tools?: string; // omit for full default tool access
	signal?: AbortSignal;
	onLog: (line: string) => void;
	onTool: (label: string) => void; // "" clears the current-tool display
	onText: (recentLines: string[]) => void; // streamed model output, last N non-empty lines
	onAsk: (req: AskRequest) => Promise<AskAnswer>;
}

/** Spawn a child `pi` in RPC mode, streaming progress and relaying prompts. */
function runChildPi(opts: RunOptions): Promise<{ text: string; error?: string }> {
	return new Promise((resolve) => {
		// Extensions stay on (same global set as the interactive session) so OAuth/billing
		// compat (pi-claude) and other global extensions apply to the child too — only
		// session history is isolated. `/spawn` still restricts tools via `opts.tools`.
		const args = [
			"--mode",
			"rpc",
			"--no-session",
			"--model",
			`${opts.model}:${opts.thinking}`,
			...(opts.tools ? ["--tools", opts.tools] : []),
		];
		const child = spawn("pi", args, { cwd: opts.cwd, stdio: ["pipe", "pipe", "pipe"] });

		let stderr = "";
		let settled = false;
		const textAcc = { value: "" };

		const send = (obj: Record<string, unknown>) => {
			child.stdin.write(`${JSON.stringify(obj)}\n`);
		};

		const finish = (result: { text: string; error?: string }) => {
			if (settled) return;
			settled = true;
			try {
				child.stdin.end();
			} catch {
				// already closed
			}
			setTimeout(() => {
				if (!child.killed) child.kill("SIGTERM");
			}, 200);
			resolve(result);
		};

		child.on("error", (err) => finish({ text: "", error: err.message }));
		opts.signal?.addEventListener("abort", () => finish({ text: "", error: "killed by user" }), { once: true });
		child.stderr.on("data", (d) => {
			stderr += d.toString();
		});
		child.on("close", (code) => {
			if (!settled) finish({ text: "", error: stderr.trim() || `child pi exited with code ${code}` });
		});

		attachJsonlReader(child.stdout, (line) => {
			let data: Record<string, unknown>;
			try {
				data = JSON.parse(line);
			} catch {
				return;
			}

			switch (data.type) {
				case "response": {
					if (data.command === "prompt" && data.success === false) {
						finish({ text: "", error: String(data.error ?? "prompt rejected") });
					} else if (data.command === "get_last_assistant_text") {
						const text = (data.data as { text: string | null } | undefined)?.text ?? "";
						finish({ text });
					}
					break;
				}
				case "extension_ui_request": {
					// SAFETY: RPC protocol (docs/rpc.md) guarantees extension_ui_request events carry
					// id/method and the method-specific fields asserted below.
					const req = data as unknown as AskRequest;
					if (["select", "confirm", "input", "editor"].includes(req.method)) {
						opts.onAsk(req).then((answer) => {
							if (answer.cancelled) {
								send({ type: "extension_ui_response", id: req.id, cancelled: true });
							} else if (req.method === "confirm") {
								send({ type: "extension_ui_response", id: req.id, confirmed: !!answer.confirmed });
							} else {
								send({ type: "extension_ui_response", id: req.id, value: answer.value ?? "" });
							}
						});
					} else if (req.method === "notify") {
						opts.onLog(`[child] ${(data as { message?: string }).message ?? ""}`);
					}
					break;
				}
				case "agent_start":
					opts.onLog("investigating…");
					break;
				case "message_update": {
					const ame = (data.assistantMessageEvent ?? {}) as { type?: string; delta?: string };
					if (ame.type === "text_delta" && ame.delta) {
						textAcc.value += ame.delta;
						opts.onText(
							textAcc.value
								.split("\n")
								.map((l) => l.trim())
								.filter(Boolean)
								.slice(-2),
						);
					}
					break;
				}
				case "message_end": {
					const msg = data.message as { role?: string; stopReason?: string; errorMessage?: string } | undefined;
					if (msg?.role === "assistant" && msg.stopReason === "error") {
						finish({ text: "", error: msg.errorMessage ?? "model call failed" });
					}
					break;
				}
				case "tool_execution_start":
					opts.onTool(formatTool(data.toolName as string | undefined, data.args as Record<string, unknown> | undefined));
					break;
				case "tool_execution_end":
					opts.onTool("");
					break;
				case "agent_settled":
					send({ id: "final", type: "get_last_assistant_text" });
					break;
				case "extension_error":
					opts.onLog(`[error] ${(data as { error?: string }).error ?? ""}`);
					break;
			}
		});

		send({ type: "prompt", message: opts.task });
	});
}

/** Live component: body rebuilt from `run` on every render, so requestRender() shows fresh state. */
function liveRunningBox(run: ActiveRun, theme: Theme): Component {
	return {
		render: (width: number) => renderRunningBox(run, theme).render(width),
		invalidate() {},
	};
}

function renderRunningBox(run: ActiveRun, theme: Theme): Component {
	const body: string[] = [];
	if (run.pending) {
		const q = run.pending.req.title ?? run.pending.req.message ?? "question";
		body.push(theme.fg("warning", `❓ press ${ANSWER_KEY_HINT} to answer: ${q}`));
	} else {
		const spin = theme.fg("warning", SPINNER_FRAMES[run.frame % SPINNER_FRAMES.length]);
		body.push(`${spin} ${theme.fg("dim", `${((Date.now() - run.startedAt) / 1000).toFixed(1)}s`)}`);
		if (run.currentTool) body.push(theme.fg("dim", `⟳ ${run.currentTool}`));
		const rest = run.streamText.length > 0 ? run.streamText : run.log;
		for (const line of rest.slice(-(BODY_LINES - body.length))) body.push(theme.fg("dim", line));
	}
	return drawBox(run.header, body, theme, run.pending ? "warning" : "borderAccent");
}

/** The real dialog for one ask request — used both by the answer keybinding. */
async function showAskDialog(ui: ExtensionUIContext, req: AskRequest): Promise<AskAnswer> {
	if (req.method === "select") {
		const value = await ui.select(req.title ?? "Select", req.options ?? []);
		return { value, cancelled: value === undefined };
	}
	if (req.method === "confirm") {
		const confirmed = await ui.confirm(req.title ?? "Confirm", req.message ?? "");
		return { confirmed };
	}
	const value = await ui.input(req.title ?? "Input", req.placeholder);
	return { value, cancelled: value === undefined };
}

/** Primary path: caller has UI (interactive or `--mode rpc`) — live box, deferred ask. */
async function runWithBox(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	header: string,
	opts: Omit<RunOptions, "onLog" | "onTool" | "onText" | "onAsk">,
): Promise<void> {
	const run: ActiveRun = {
		id: randomUUID().slice(0, 6),
		header,
		abort: new AbortController(),
		log: [],
		currentTool: "",
		streamText: [],
		frame: 0,
		startedAt: Date.now(),
		render: () => {},
	};
	const widgetKey = `${WIDGET_KEY}:${run.id}`;
	// setWidget builds+mounts the Component once; calling it again on every update would
	// dispose and rebuild the whole widget (choppy/stuck during fast text-delta streams).
	// Redraws instead go through tui.requestRender() on the same live Component below.
	run.render = () => run.tui?.requestRender();
	ctx.ui.setWidget(widgetKey, (tui, theme) => {
		run.tui = tui;
		return liveRunningBox(run, theme);
	});
	runs.set(run.id, run);

	const spinnerTimer = setInterval(() => {
		run.frame++;
		run.tui?.requestRender();
	}, SPINNER_TICK_MS);

	const { text, error } = await runChildPi({
		...opts,
		signal: run.abort.signal,
		onLog: (line) => {
			run.log.push(line);
			run.render();
		},
		onTool: (label) => {
			run.currentTool = label;
			if (label) run.log.push(`⟳ ${label}`);
			run.render();
		},
		onText: (lines) => {
			run.streamText = lines;
			run.render();
		},
		onAsk: (req) =>
			new Promise<AskAnswer>((resolve) => {
				run.pending = { req, resolve: (a) => resolve(a) };
				run.log.push(`[ask] ${req.title ?? req.message ?? req.method}`);
				run.render();
			}),
	});

	clearInterval(spinnerTimer);
	runs.delete(run.id);
	ctx.ui.setWidget(widgetKey, undefined);
	sendResult(pi, header, text, error);
}

/** Fallback path: no UI (print/json mode) — vertical tmux pane, or best-effort headless. */
async function runWithTmux(
	pi: ExtensionAPI,
	exec: ExecFn,
	header: string,
	opts: Omit<RunOptions, "onLog" | "onTool" | "onText" | "onAsk">,
): Promise<void> {
	if (!process.env.TMUX) {
		// Not inside tmux: no surface to show progress or ask questions on.
		const { text, error } = await runChildPi({
			...opts,
			onLog: () => {},
			onTool: () => {},
			onText: () => {},
			onAsk: async () => ({ cancelled: true }),
		});
		sendResult(pi, header, text, error);
		return;
	}

	const dir = await mkdtemp(join(tmpdir(), "pi-spawn-"));
	const logFile = join(dir, "log.txt");
	await writeFile(logFile, `${header}\n`);
	const appendLog = (line: string) => appendFile(logFile, `${line}\n`).catch(() => {});

	await exec("tmux", ["split-window", "-v", `tail -n +1 -f '${logFile}'`]);

	const askViaTmux = async (req: AskRequest): Promise<AskAnswer> => {
		const channel = `pi-spawn-${randomUUID()}`;
		const answerFile = join(dir, `${channel}.ans`);
		const question =
			req.method === "confirm"
				? `${req.title ?? "Confirm"}${req.message ? `: ${req.message}` : ""} (y/n)`
				: req.method === "select"
					? `${req.title ?? "Select"} [${(req.options ?? []).join(" | ")}]`
					: (req.title ?? "Input");

		await appendLog(`[ask] ${question}`);
		await exec("tmux", [
			"command-prompt",
			"-p",
			truncate(question, 120),
			`run-shell "printf '%s' '%1' > '${answerFile}'; tmux wait-for -S ${channel}"`,
		]);

		const waited = await exec("tmux", ["wait-for", channel], { timeout: 5 * 60_000 });
		if (waited.killed) return { cancelled: true };

		const raw = (await readFile(answerFile, "utf8").catch(() => "")).trim();
		await rm(answerFile, { force: true });
		if (!raw) return { cancelled: true };
		if (req.method === "confirm") return { confirmed: /^y(es)?$/i.test(raw) };
		return { value: raw };
	};

	const { text, error } = await runChildPi({
		...opts,
		onLog: (line) => void appendLog(line),
		onTool: (label) => label && void appendLog(`[tool] ${label}`),
		onText: () => {},
		onAsk: askViaTmux,
	});

	await appendLog("");
	await appendLog(error ? `[error] ${error}` : text || "(no output)");
	sendResult(pi, header, text, error);
	// Pane is left open (tail -f) showing the final result; user closes it manually.
}

export default function (pi: ExtensionAPI) {
	pi.registerEntryRenderer<{ header: string; lines: string[] }>(LOG_ENTRY_TYPE, (entry) => ({
		render(width: number): string[] {
			if (!entry.data) return [];
			const out = [entry.data.header, ...entry.data.lines];
			return out.map((l) => truncate(l, width));
		},
		invalidate() {},
	}));

	pi.registerMessageRenderer<ResultDetails>(RESULT_MESSAGE_TYPE, (message, _options, theme) => {
		if (!message.details) return undefined;
		const { header, output, error } = message.details;
		const body = (error ?? output ?? "(no output)").split("\n");
		return drawBox(header, body, theme, error ? "error" : "success");
	});

	pi.registerShortcut(ANSWER_KEY_HINT, {
		description: "pi-spawn: answer oldest pending question, or view a run log",
		handler: async (shortcutCtx) => {
			if (runs.size === 0) {
				shortcutCtx.ui.notify("pi-spawn: no active run", "info");
				return;
			}
			const waiting = [...runs.values()].find((r) => r.pending);
			if (waiting?.pending) {
				const { req, resolve } = waiting.pending;
				const answer = await showAskDialog(shortcutCtx.ui, req);
				waiting.pending = undefined;
				waiting.render();
				resolve(answer);
				return;
			}
			const run = await pickRun(shortcutCtx.ui, "pi-spawn: view log of");
			if (run) pi.appendEntry(LOG_ENTRY_TYPE, { header: run.header, lines: run.log });
		},
	});

	pi.registerCommand("spawns", {
		description: "List running spawns; view a run's log or kill it",
		handler: async (_args, ctx) => {
			if (runs.size === 0) {
				ctx.ui.notify("pi-spawn: no active run", "info");
				return;
			}
			const run = await pickRun(ctx.ui, "Running spawns");
			if (!run) return;
			const action = await ctx.ui.select(runLabel(run), ["View log", "Kill"]);
			if (action === "View log") pi.appendEntry(LOG_ENTRY_TYPE, { header: run.header, lines: run.log });
			else if (action === "Kill") run.abort.abort();
		},
	});

	pi.registerCommand("spawn", {
		description: "Spawn a read-only child pi process for one focused investigation",
		handler: async (args, ctx) => {
			const task = args.trim();
			if (!task) {
				ctx.ui.notify("Usage: /spawn <task>", "warning");
				return;
			}
			const opts = {
				task: SPAWN_INSTRUCTIONS + task,
				cwd: ctx.cwd,
				model: "anthropic/claude-haiku-5-5",
				thinking: "low",
				tools: "read,grep,find,ls",
			};
			const header = truncate(`spawn: ${task}`, LINE_WIDTH);
			if (ctx.hasUI) {
				await runWithBox(pi, ctx, header, opts);
			} else {
				await runWithTmux(pi, pi.exec.bind(pi), header, opts);
			}
		},
	});

	for (const entry of REGISTRY) {
		pi.registerCommand(entry.name, {
			description: `Fast command: /${entry.name}`,
			handler: async (args, ctx) => {
				const rawPrompt = readFileSync(join(DIR, entry.prompt), "utf8");
				const task = args.trim()
					? `${EXEC_PREAMBLE}${rawPrompt}\n\nAdditional context: ${args.trim()}`
					: `${EXEC_PREAMBLE}${rawPrompt}`;
				const opts = { task, cwd: ctx.cwd, model: entry.model, thinking: entry.thinking };
				const header = `/${entry.name} · ${entry.model} · ${entry.thinking}`;
				if (ctx.hasUI) {
					await runWithBox(pi, ctx, header, opts);
				} else {
					await runWithTmux(pi, pi.exec.bind(pi), header, opts);
				}
			},
		});
	}
}
