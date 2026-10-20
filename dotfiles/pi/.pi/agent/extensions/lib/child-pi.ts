/**
 * Shared RPC child runner for pi-spawn and pi-orca: spawns `pi --mode rpc`, streams progress,
 * relays `extension_ui_request` asks through `onAsk`, and returns the final text plus usage.
 * Scheduling and ask semantics stay with each caller (see docs/adr/0007).
 *
 * Lives in a folder without index.ts so pi does not load it as an extension.
 */

import { spawn } from "node:child_process";
import type { Usage } from "@earendil-works/pi-ai";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

/** Set on every child, so extensions can skip behavior meant for the top-level session. */
export const CHILD_ENV = "PI_CHILD";

export interface AskRequest {
	id: string;
	method: string;
	title?: string;
	message?: string;
	options?: string[];
	placeholder?: string;
	prefill?: string;
}

export interface AskAnswer {
	value?: string;
	confirmed?: boolean;
	cancelled?: boolean;
}

export interface RunOptions {
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

export interface RunResult {
	text: string;
	error?: string;
	usage: Usage;
}

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

function emptyUsage(): Usage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function addUsage(acc: Usage, u: Usage): void {
	acc.input += u.input;
	acc.output += u.output;
	acc.cacheRead += u.cacheRead;
	acc.cacheWrite += u.cacheWrite;
	acc.totalTokens += u.totalTokens;
	acc.cost.input += u.cost.input;
	acc.cost.output += u.cost.output;
	acc.cost.cacheRead += u.cost.cacheRead;
	acc.cost.cacheWrite += u.cost.cacheWrite;
	acc.cost.total += u.cost.total;
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

/** The real dialog for one ask request. */
export async function showAskDialog(ui: ExtensionUIContext, req: AskRequest): Promise<AskAnswer> {
	if (req.method === "select") {
		const value = await ui.select(req.title ?? "Select", req.options ?? []);
		return { value, cancelled: value === undefined };
	}
	if (req.method === "confirm") {
		const confirmed = await ui.confirm(req.title ?? "Confirm", req.message ?? "");
		return { confirmed };
	}
	const value =
		req.method === "editor"
			? await ui.editor(req.title ?? "Edit", req.prefill)
			: await ui.input(req.title ?? "Input", req.placeholder);
	return { value, cancelled: value === undefined };
}

/** Spawn a child `pi` in RPC mode, streaming progress and relaying prompts. */
export function runChildPi(opts: RunOptions): Promise<RunResult> {
	return new Promise((resolve) => {
		// Extensions stay on (same global set as the interactive session) so OAuth/billing
		// compat (pi-claude) and other global extensions apply to the child too — only
		// session history is isolated. Callers restrict tools via `opts.tools`.
		const args = [
			"--mode",
			"rpc",
			"--no-session",
			"--model",
			`${opts.model}:${opts.thinking}`,
			...(opts.tools ? ["--tools", opts.tools] : []),
		];
		const child = spawn("pi", args, {
			cwd: opts.cwd,
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env, [CHILD_ENV]: "1" },
		});

		let stderr = "";
		let settled = false;
		const textAcc = { value: "" };
		const usage = emptyUsage();

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
			resolve({ ...result, usage });
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
					const msg = data.message as
						| { role?: string; stopReason?: string; errorMessage?: string; usage?: Usage }
						| undefined;
					if (msg?.role === "assistant" && msg.usage) addUsage(usage, msg.usage);
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
