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
import type { Component } from "@earendil-works/pi-tui";
import { visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DIR = dirname(fileURLToPath(import.meta.url));

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

async function runChild(entry: CommandEntry, prompt: string, cwd: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "pi",
    ["-p", "--model", entry.model, "--thinking", entry.thinking, "--no-session", prompt],
    { cwd, maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout.trim();
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

        ctx.ui.setWorkingMessage(`/${entry.name} running (${entry.model})…`);
        try {
          for (let round = 0; round <= MAX_ASK_ROUNDS; round++) {
            const output = await runChild(entry, prompt, ctx.cwd);

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
          ctx.ui.setWorkingMessage();
        }
      },
    });
  }
}
