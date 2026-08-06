/**
 * fast-commands/index.ts — self-owned git-workflow slash commands.
 *
 * Registers /commit, /standup, /pr, /pr-check, /test, /review from
 * commands.json ({name, model, thinking, prompt}). Each spawns `pi -p`
 * (headless, direct child process — no pi-subagents) with the matching
 * prompt file as the instructions, then feeds the result back into this
 * thread. See docs/adr/0001-self-owned-fast-commands.md and 0002.
 *
 * ASK: bridge — if the child's entire stdout is `ASK: <question>`, show
 * that question via the real ask_user overlay, re-run with the answer
 * folded into the prompt. Capped at 3 rounds so a confused child can't
 * loop forever.
 */

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const DIR = dirname(fileURLToPath(import.meta.url));
const SPINNER_FRAMES = ["⠳", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

interface CommandEntry {
  name: string;
  model: string;
  thinking: string;
  prompt: string;
}

const MAX_ASK_ROUNDS = 3;
const RESULT_MESSAGE_TYPE = "fast-command-result";

interface FastCommandResultDetails {
  name: string;
  output: string;
}

// Plain bordered box — pi-tui's Box only does bg/padding, no border chars, so draw ─│ ourselves.
function renderResultBox(details: FastCommandResultDetails, theme: Theme): Component {
  return {
    render(width: number): string[] {
      const innerWidth = Math.max(10, width - 4);
      const title = ` /${details.name} `;
      const topRule = "─".repeat(Math.max(0, innerWidth + 2 - visibleWidth(title)));
      const lines: string[] = [];
      lines.push(theme.fg("borderAccent", `┌${title}${topRule}┐`));
      for (const raw of details.output.split("\n")) {
        for (const wrapped of wrapTextWithAnsi(raw, innerWidth) || [""]) {
          const pad = " ".repeat(Math.max(0, innerWidth - visibleWidth(wrapped)));
          lines.push(
            `${theme.fg("borderAccent", "│")} ${theme.fg("customMessageText", wrapped)}${pad} ${theme.fg("borderAccent", "│")}`,
          );
        }
      }
      lines.push(theme.fg("borderAccent", `└${"─".repeat(innerWidth + 2)}┘`));
      return lines;
    },
  };
}

// Live state driving the running widget — mutated by JSON events + a 100ms spinner tick.
interface WidgetState {
  frame: number;
  elapsedMs: number;
  currentTool: string;
  recentText: string[];
  retrying: boolean;
  retryAttempt: number;
}

function formatTool(name: string | undefined, args: Record<string, unknown> | undefined): string {
  if (!name) return "";
  const n = name.toLowerCase();
  if (!args) return n;
  if (n === "bash" && typeof args.command === "string") return `bash: ${args.command.slice(0, 60)}`;
  if ((n === "read" || n === "write" || n === "edit") && typeof args.path === "string") return `${n}: ${args.path}`;
  if (n === "grep" && typeof args.pattern === "string") return `grep: ${args.pattern}`;
  return n;
}

// Bordered box, redrawn on every requestRender — spinner/elapsed header + current tool + last streamed lines.
function renderRunningBox(name: string, model: string, state: WidgetState, theme: Theme): Component {
  return {
    render(width: number): string[] {
      const innerWidth = Math.max(10, width - 4);
      const title = ` /${name} `;
      const topRule = "─".repeat(Math.max(0, innerWidth + 2 - visibleWidth(title)));
      const spin = theme.fg("warning", SPINNER_FRAMES[state.frame % SPINNER_FRAMES.length]!);
      const body: string[] = [
        `${spin} ${theme.fg("customMessageText", model)}${theme.fg("dim", ` ${(state.elapsedMs / 1000).toFixed(1)}s`)}`,
      ];
      if (state.retrying) body.push(theme.fg("warning", `↻ retry ${state.retryAttempt}…`));
      else if (state.currentTool) body.push(theme.fg("dim", `⟳ ${state.currentTool}`));
      for (const line of state.recentText) body.push(theme.fg("dim", line));

      const lines: string[] = [theme.fg("borderAccent", `┌${title}${topRule}┐`)];
      for (const raw of body) {
        for (const wrapped of wrapTextWithAnsi(raw, innerWidth) || [""]) {
          const pad = " ".repeat(Math.max(0, innerWidth - visibleWidth(wrapped)));
          lines.push(`${theme.fg("borderAccent", "│")} ${wrapped}${pad} ${theme.fg("borderAccent", "│")}`);
        }
      }
      lines.push(theme.fg("borderAccent", `└${"─".repeat(innerWidth + 2)}┘`));
      return lines;
    },
  };
}

// Mutates `state` per JSONL event (tool start/end, streamed text, retries). Unknown/non-JSON lines are skipped.
function applyEvent(line: string, state: WidgetState, textAcc: { value: string }): void {
  let event: { type: string; toolName?: string; args?: Record<string, unknown>; assistantMessageEvent?: { type: string; delta?: string }; attempt?: number };
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }
  switch (event.type) {
    case "tool_execution_start":
      state.currentTool = formatTool(event.toolName, event.args);
      break;
    case "tool_execution_end":
      state.currentTool = "";
      break;
    case "message_update": {
      const ame = event.assistantMessageEvent;
      if (ame?.type === "text_delta" && ame.delta) {
        textAcc.value += ame.delta;
        state.recentText = textAcc.value.split("\n").map((l) => l.trim()).filter(Boolean).slice(-2);
      }
      break;
    }
    case "auto_retry_start":
      state.retrying = true;
      state.retryAttempt = event.attempt ?? 1;
      break;
    case "auto_retry_end":
      state.retrying = false;
      break;
  }
}

// Spawns `pi --mode json -p` (JSONL event stream) instead of plain `-p` so the widget has something to show live.
function runChild(
  entry: CommandEntry,
  prompt: string,
  cwd: string,
  state: WidgetState,
  onUpdate: () => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "pi",
      ["--model", entry.model, "--thinking", entry.thinking, "--no-session", "--mode", "json", "-p", prompt],
      { cwd, stdio: ["ignore", "pipe", "pipe"] },
    );
    const textAcc = { value: "" };
    let buf = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          applyEvent(line, state, textAcc);
          onUpdate();
        }
      }
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (buf.trim()) applyEvent(buf, state, textAcc);
      if (code !== 0 && !textAcc.value.trim()) {
        reject(new Error(stderr.trim() || `pi exited with code ${code}`));
        return;
      }
      resolve(textAcc.value.trim());
    });
  });
}

export default function (pi: ExtensionAPI): void {
  const registry: CommandEntry[] = JSON.parse(readFileSync(join(DIR, "commands.json"), "utf-8"));

  pi.registerMessageRenderer<FastCommandResultDetails>(RESULT_MESSAGE_TYPE, (message, _options, theme) =>
    message.details ? renderResultBox(message.details, theme) : undefined,
  );

  for (const entry of registry) {
    pi.registerCommand(entry.name, {
      description: `Fast command: ${entry.name}`,
      handler: async (args, ctx) => {
        const rawPrompt = readFileSync(join(DIR, entry.prompt), "utf-8");
        // prompt .md files are passive numbered steps (docs, not directives) — without
        // an imperative wrapper the child just describes the workflow instead of doing it.
        const basePrompt = `Execute the following instructions now, taking action with your tools. Do not just describe them or ask for confirmation unless the instructions say to.\n\n${rawPrompt}`;
        let prompt = args.trim() ? `${basePrompt}\n\nAdditional context: ${args.trim()}` : basePrompt;

        const state: WidgetState = { frame: 0, elapsedMs: 0, currentTool: "", recentText: [], retrying: false, retryAttempt: 0 };
        let widgetTui: TUI | undefined;

        ctx.ui.setWorkingMessage(`/${entry.name} running (${entry.model})…`);
        ctx.ui.setWidget(entry.name, (tui, theme) => {
          widgetTui = tui;
          return renderRunningBox(entry.name, entry.model, state, theme);
        });
        const spinnerTimer = setInterval(() => {
          state.frame++;
          state.elapsedMs += 100;
          widgetTui?.requestRender();
        }, 100);

        try {
          for (let round = 0; round <= MAX_ASK_ROUNDS; round++) {
            state.currentTool = "";
            state.recentText = [];
            state.retrying = false;
            const output = await runChild(entry, prompt, ctx.cwd, state, () => widgetTui?.requestRender());

            if (output.startsWith("ASK:") && round < MAX_ASK_ROUNDS) {
              const question = output.slice(4).trim();
              const answer = await ctx.ui.input(question);
              if (answer === undefined) {
                ctx.ui.notify(`/${entry.name} cancelled`, "info");
                return;
              }
              prompt = `${basePrompt}\n\nAdditional context: ${args.trim()}\n\nQ: ${question}\nA: ${answer}`;
              continue;
            }

            pi.sendMessage<FastCommandResultDetails>(
              { customType: RESULT_MESSAGE_TYPE, content: `/${entry.name} result:\n\n${output}`, display: true, details: { name: entry.name, output } },
              { triggerTurn: true },
            );
            return;
          }
          ctx.ui.notify(`/${entry.name} kept asking questions past the round limit`, "warning");
        } catch (err) {
          ctx.ui.notify(`/${entry.name} failed: ${err instanceof Error ? err.message : String(err)}`, "error");
        } finally {
          clearInterval(spinnerTimer);
          ctx.ui.setWorkingMessage();
          ctx.ui.setWidget(entry.name, undefined);
        }
      },
    });
  }
}
