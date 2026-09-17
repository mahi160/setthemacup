/**
 * pi-spawn: run a read-only child `pi` process for one focused investigation.
 *
 * /spawn <task>  - spawn a read-only child pi (RPC mode) and report its final answer
 *
 * Progress display:
 * - When the caller has UI (interactive or `--mode rpc`): a live status box, capped
 *   at 10 lines, shown via ctx.ui.setWidget (a pi UI primitive — no custom terminal code).
 * - Otherwise (print/json mode, no UI to attach a widget to): falls back to a vertical
 *   tmux pane (when running inside tmux) that tails the child's progress and prints
 *   the final result.
 *
 * Ask relay: if the child needs to prompt the user (e.g. a project-trust decision),
 * its `extension_ui_request` is forwarded to the caller — via ctx.ui in box mode, or
 * via `tmux command-prompt` in tmux mode — and the answer is sent back to the child
 * so it can resume.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExecOptions, ExecResult } from "@earendil-works/pi-coding-agent";

type ExecFn = (command: string, args: string[], options?: ExecOptions) => Promise<ExecResult>;

const SPAWN_INSTRUCTIONS = `Read-only investigation task. Rules:
- Inspect only what is necessary to answer.
- Do not modify any files.
- Do not explain your process or steps taken.
- Return only a concise final result.
- Include relevant file paths and line numbers.
- If evidence is insufficient, say so explicitly instead of guessing.

Task: `;

const WIDGET_KEY = "pi-spawn";
const MAX_BOX_LINES = 10;
const LINE_WIDTH = 78;

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
	onLog: (line: string) => void;
	onAsk: (req: AskRequest) => Promise<AskAnswer>;
}

/** Spawn a read-only child `pi` in RPC mode, streaming progress and relaying prompts. */
function runChildPi(opts: RunOptions): Promise<{ text: string; error?: string }> {
	return new Promise((resolve) => {
		const child = spawn(
			"pi",
			[
				"--mode",
				"rpc",
				"--no-session",
				"--no-extensions",
				"--tools",
				"read,grep,find,ls",
				"--model",
				"anthropic/claude-haiku-4-5:low",
			],
			{ cwd: opts.cwd, stdio: ["pipe", "pipe", "pipe"] },
		);

		let stderr = "";
		let settled = false;

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
				case "message_end": {
					const msg = data.message as { role?: string; stopReason?: string; errorMessage?: string } | undefined;
					if (msg?.role === "assistant" && msg.stopReason === "error") {
						finish({ text: "", error: msg.errorMessage ?? "model call failed" });
					}
					break;
				}
				case "tool_execution_start":
					opts.onLog(`[tool] ${data.toolName}`);
					break;
				case "agent_settled":
					send({ id: "final", type: "get_last_assistant_text" });
					break;
				case "extension_error":
					opts.onLog(`[error] ${(data as { error?: string }).error ?? ""}`);
					break;
			}
		});

		send({ type: "prompt", message: SPAWN_INSTRUCTIONS + opts.task });
	});
}

/** Primary path: caller has UI (interactive or `--mode rpc`) — live box + native dialogs. */
async function runWithBox(ctx: ExtensionCommandContext, task: string): Promise<void> {
	const lines: string[] = [truncate(`spawn: ${task}`, LINE_WIDTH)];
	const render = () => ctx.ui.setWidget(WIDGET_KEY, lines.slice(-MAX_BOX_LINES));
	render();

	const { text, error } = await runChildPi({
		task,
		cwd: ctx.cwd,
		onLog: (line) => {
			lines.push(truncate(line, LINE_WIDTH));
			render();
		},
		onAsk: async (req): Promise<AskAnswer> => {
			if (req.method === "select") {
				const value = await ctx.ui.select(req.title ?? "Select", req.options ?? []);
				return { value, cancelled: value === undefined };
			}
			if (req.method === "confirm") {
				const confirmed = await ctx.ui.confirm(req.title ?? "Confirm", req.message ?? "");
				return { confirmed };
			}
			const value = await ctx.ui.input(req.title ?? "Input", req.placeholder);
			return { value, cancelled: value === undefined };
		},
	});

	ctx.ui.setWidget(WIDGET_KEY, undefined);
	ctx.ui.notify(error ? `Spawn failed: ${error}` : text || "(no output)", error ? "error" : "info");
}

/** Fallback path: no UI (print/json mode) — vertical tmux pane, or best-effort headless. */
async function runWithTmux(ctx: ExtensionCommandContext, exec: ExecFn, task: string): Promise<void> {
	if (!process.env.TMUX) {
		// Not inside tmux: no surface to show progress or ask questions on.
		const { text, error } = await runChildPi({
			task,
			cwd: ctx.cwd,
			onLog: () => {},
			onAsk: async () => ({ cancelled: true }),
		});
		ctx.ui.notify(error ? `Spawn failed: ${error}` : text || "(no output)", error ? "error" : "info");
		return;
	}

	const dir = await mkdtemp(join(tmpdir(), "pi-spawn-"));
	const logFile = join(dir, "log.txt");
	await writeFile(logFile, `spawn: ${task}\n`);
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
		task,
		cwd: ctx.cwd,
		onLog: (line) => void appendLog(line),
		onAsk: askViaTmux,
	});

	await appendLog("");
	await appendLog(error ? `[error] ${error}` : text || "(no output)");
	ctx.ui.notify(error ? `Spawn failed: ${error}` : text || "(no output)", error ? "error" : "info");
	// Pane is left open (tail -f) showing the final result; user closes it manually.
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("spawn", {
		description: "Spawn a read-only child pi process for one focused investigation",
		handler: async (args, ctx) => {
			const task = args.trim();
			if (!task) {
				ctx.ui.notify("Usage: /spawn <task>", "warning");
				return;
			}
			if (ctx.hasUI) {
				await runWithBox(ctx, task);
			} else {
				await runWithTmux(ctx, pi.exec.bind(pi), task);
			}
		},
	});
}
