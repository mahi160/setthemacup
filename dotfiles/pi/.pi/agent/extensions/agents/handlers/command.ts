/**
 * handlers/command.ts — Fast commands (/commit, /pr, /standup, /review, /test).
 *
 * Routes user slash commands from fast-commands.json.
 * Each command has full agent config (prompt, role, tools, thinking).
 * Output display: "notify" (toast) or "file" (inline markdown).
 */

import { Markdown, getMarkdownTheme } from "@earendil-works/pi-tui";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { runCommand } from "../../shared/command-runner";
import { buildMessage, type Model } from "../../shared/spawn-subagent";

export interface FastCommand {
  name: string;
  label: string;
  icon: string;
  description: string;
  thinking: string;
  tools: string[];
  role: string;
  output?: "notify" | "file";
  prompt: string | string[];
}

export interface CommandHandlerOptions {
  fastCommands: FastCommand[];
  models: Model[];
  pi: ExtensionAPI;
}

/**
 * Register fast commands (/commit, /pr, /standup, /review, /test).
 * All config comes from fast-commands.json (no external references).
 */
export function registerCommands(
  pi: ExtensionAPI,
  fastCommands: FastCommand[],
  models: Model[],
): void {
  // Message renderer for "file" output
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

  let activeCommand = "";
  let cachedModel: Model | null | undefined = undefined;

  // Reset state
  pi.on("session_start", () => {
    activeCommand = "";
    cachedModel = undefined;
  });

  pi.on("session_shutdown", () => {
    activeCommand = "";
    cachedModel = undefined;
  });

  // Helper: resolve model from credentials
  async function resolveModel(ctx: ExtensionCommandContext): Promise<Model | undefined> {
    if (cachedModel !== undefined) return cachedModel ?? undefined;
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

  // Register each command
  for (const fcmd of fastCommands) {
    // fcmd has full agent config inline
    const agent = fcmd;

    pi.registerCommand(fcmd.name, {
      description: `${fcmd.description} (clean session)`,
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
