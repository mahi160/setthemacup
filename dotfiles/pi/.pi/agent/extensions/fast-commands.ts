/**
 * fast-commands.ts
 *
 * Reads fast-commands.json and registers each command.
 * To add/edit commands, only touch fast-commands.json.
 *
 * JSON schema:
 *   models[]          — ordered list of fast models to try (first with API key wins)
 *   commands[].name   — slash command name
 *   commands[].description
 *   commands[].role   — injected as "Role: <role>." prefix
 *   commands[].prompt — string or string[] (joined with \n)
 *   commands[].argsDefault — fallback text when {args} placeholder is used but args is empty
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

// ── config ────────────────────────────────────────────────────────────────────

interface FastModel {
  provider: string;
  id: string;
}
interface FastCommand {
  name: string;
  description: string;
  role: string;
  prompt: string | string[];
  argsDefault?: string;
}
interface Config {
  models: FastModel[];
  commands: FastCommand[];
}

const configPath = join(__dirname, "fast-commands.json");
const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));

// ── helpers ───────────────────────────────────────────────────────────────────

function buildMessage(cmd: FastCommand, args: string): string {
  const body = Array.isArray(cmd.prompt) ? cmd.prompt.join("\n") : cmd.prompt;

  const argsText = args.trim() || cmd.argsDefault || args;
  const resolved = body.replace(/\{args\}/g, argsText);

  return `Role: ${cmd.role}.\n\n${resolved}`;
}

function registerFastCommand(pi: ExtensionAPI, cmd: FastCommand) {
  // Captured before model switch; cleared after restore.
  // Persistent listener — no pi.off() needed.
  let modelToRestore: Model | undefined;

  pi.on("agent_end", async (event, ctx) => {
    if (!modelToRestore) return;
    const target = modelToRestore;
    modelToRestore = undefined;

    const errMsg = (event.messages as AssistantMessage[])
      .filter((m) => m.role === "assistant")
      .find((m) => m.stopReason === "error" || m.stopReason === "aborted");

    if (errMsg) {
      ctx.ui.notify(
        `/${cmd.name} failed: ${errMsg.errorMessage ?? errMsg.stopReason}`,
        "error",
      );
    }

    const success = await pi.setModel(target);
    if (success) {
      ctx.ui.notify(`↩ Restored model: ${target.id}`, "info");
    }
  });

  pi.registerCommand(cmd.name, {
    description: `${cmd.description} (fast model)`,
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      await ctx.waitForIdle();

      // Capture BEFORE any setModel call — ctx.model is a live reference
      const originalModel = ctx.model;

      // Try each fast model in order
      let fastModel: Model | undefined;
      let fastModelId = "";
      for (const candidate of config.models) {
        const found = ctx.modelRegistry.find(candidate.provider, candidate.id);
        if (!found) continue;

        const switched = await pi.setModel(found);
        if (switched) {
          fastModel = found;
          fastModelId = found.id;
          break;
        }
        ctx.ui.notify(`No API key for ${candidate.id}, trying next…`, "info");
      }

      if (!fastModel) {
        ctx.ui.notify(
          `No fast model available. Tried: ${config.models.map((m) => m.id).join(", ")}`,
          "error",
        );
        return;
      }

      ctx.ui.notify(`⚡ Switched to ${fastModelId} for /${cmd.name}`, "info");
      modelToRestore = originalModel;
      pi.sendUserMessage(buildMessage(cmd, args));
    },
  });
}

// ── extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  for (const cmd of config.commands) {
    registerFastCommand(pi, cmd);
  }
}
