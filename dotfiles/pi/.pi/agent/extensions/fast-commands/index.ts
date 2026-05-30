/**
 * fast-commands — User-facing slash commands (/commit, /pr, /standup).
 *
 * Routes commands to subagents by name, spawns clean sessions, handles output.
 * All heavy lifting delegated to shared helpers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Markdown, getMarkdownTheme } from "@earendil-works/pi-tui";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { runCommand } from "../shared/command-runner";
import { buildMessage, type SubagentConfig, type Model } from "../shared/spawn-subagent";

// ── Config ─────────────────────────────────────────────────────────────────────

interface FastCommand {
  name: string;
  agentRef: string;
  output?: "notify" | "file";
}

interface FastCommandsConfig {
  commands: FastCommand[];
}

interface SubagentConfigFull {
  models: Model[];
  agents: SubagentConfig[];
}

const fastCmdConfigPath = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fast-commands.json",
);
const fastCmdConfig: FastCommandsConfig = JSON.parse(
  readFileSync(fastCmdConfigPath, "utf-8"),
);

const subagentConfigPath = join(
  fileURLToPath(new URL("../subagents", import.meta.url)),
  "subagents.json",
);
let subagentConfig: SubagentConfigFull | undefined;
try {
  subagentConfig = JSON.parse(readFileSync(subagentConfigPath, "utf-8"));
} catch (err) {
  console.warn("[fast-commands] subagents.json not found:", err);
}

// ── Session state ──────────────────────────────────────────────────────────────

let activeCommand = "";
let cachedModel: Model | null | undefined = undefined;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function resolveModel(
  ctx: ExtensionCommandContext,
): Promise<Model | undefined> {
  if (cachedModel !== undefined) return cachedModel ?? undefined;
  const models = subagentConfig?.models ?? [];
  for (const candidate of models) {
    const key = await ctx.modelRegistry.getApiKeyForProvider(
      candidate.provider,
    );
    if (key) {
      cachedModel = candidate;
      return candidate;
    }
  }
  cachedModel = models[0] ?? null;
  return cachedModel ?? undefined;
}

// ── Extension ──────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  // Message renderer for "file" output type
  pi.registerMessageRenderer("fast-result", (message, _opts, theme) => {
    const { name, text } = message.details as { name: string; text: string };
    const header = theme.fg("success", ` ✓ /${name}`);
    const md = new Markdown(text, 1, 0, getMarkdownTheme());
    return {
      render(width: number): string[] {
        return [header, "", ...md.render(width)];
      },
      invalidate() {
        md.invalidate();
      },
    };
  });

  // Reset state
  pi.on("session_start", () => {
    activeCommand = "";
    cachedModel = undefined;
  });

  pi.on("session_shutdown", () => {
    activeCommand = "";
    cachedModel = undefined;
  });

  // Register fast commands
  for (const fcmd of fastCmdConfig.commands) {
    const agent = subagentConfig?.agents.find((a) => a.name === fcmd.agentRef);
    if (!agent) {
      console.warn(
        `[fast-commands] Agent "${fcmd.agentRef}" not found in subagents.json`,
      );
      continue;
    }

    pi.registerCommand(fcmd.name, {
      description: `${agent.description} (clean session)`,
      handler: async (_args: string, ctx: ExtensionCommandContext) => {
        if (activeCommand) {
          ctx.ui.notify(
            `Already running /${activeCommand} — wait for it to finish`,
            "warning",
          );
          return;
        }

        await ctx.waitForIdle();

        const model = await resolveModel(ctx);
        if (!model) {
          ctx.ui.notify(`No model available`, "error");
          return;
        }

        activeCommand = fcmd.name;

        try {
          const { exitCode, fullText } = await runCommand({
            agent,
            model,
            prompt: buildMessage(agent),
            ctx,
          });

          if (exitCode === 0) {
            if (fcmd.output === "file") {
              pi.sendMessage(
                {
                  customType: "fast-result",
                  content: "",
                  display: true,
                  details: { name: fcmd.name, text: fullText },
                },
                { triggerTurn: false },
              );
            } else {
              const lastLine = fullText
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .at(-1) ?? "";
              ctx.ui.notify(
                `✓ /${fcmd.name}${lastLine ? `: ${lastLine.slice(0, 120)}` : ""}`,
                "success",
              );
            }
          } else {
            const lastLine = fullText
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .at(-1) ?? "";
            ctx.ui.notify(
              `✗ /${fcmd.name} failed${lastLine ? `: ${lastLine.slice(0, 120)}` : ` (exit ${exitCode})`}`,
              "error",
            );
          }
        } finally {
          activeCommand = "";
        }
      },
    });
  }

  // Ctrl+Shift+C shortcut
  pi.registerShortcut("ctrl+shift+c", {
    description: "Quick commit",
    handler: async () => {
      pi.sendUserMessage("/commit");
    },
  });
}
