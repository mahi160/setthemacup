/**
 * fast-commands.ts — Slash commands that auto-switch to a fast model.
 *
 * Features:
 *   - Reads commands from fast-commands.json (edit JSON to add/change)
 *   - Shared state machine prevents concurrent fast commands
 *   - Visual ⚡ FAST widget while active
 *   - Model restored after agent completes (handles multi-turn Q&A)
 *   - Ctrl+Shift+C shortcut for /commit
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

// ── Config schema ─────────────────────────────────────────────────────────────

interface FastModel { provider: string; id: string }
interface FastCommand {
  name: string;
  description: string;
  role: string;
  prompt: string | string[];
  argsDefault?: string;
}
interface Config { models: FastModel[]; commands: FastCommand[] }

const configPath = join(__dirname, "fast-commands.json");
const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));

// ── State machine ─────────────────────────────────────────────────────────────

type State = "idle" | "fast" | "restoring";
let state: State = "idle";
let modelToRestore: Model | undefined;
let activeCommand = "";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildMessage(cmd: FastCommand, args: string): string {
  const body = Array.isArray(cmd.prompt) ? cmd.prompt.join("\n") : cmd.prompt;
  const resolved = body.replace(/\{args\}/g, args.trim() || cmd.argsDefault || args);
  return `Role: ${cmd.role}.\n\nIMPORTANT: Use the \`spawn_subtask\` tool (name='fast-commands') for ALL shell command execution.\n\n${resolved}`;
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  // Single agent_end listener for all fast commands
  pi.on("agent_end", async (event, ctx) => {
    if (state !== "fast" || !modelToRestore) return;
    state = "restoring";

    const target = modelToRestore;
    modelToRestore = undefined;
    activeCommand = "";

    // Clear fast mode indicator
    ctx.ui.setWidget("fast-mode", undefined);

    // Check for errors
    const errMsg = (event.messages as AssistantMessage[])
      .filter(m => m.role === "assistant")
      .find(m => m.stopReason === "error" || m.stopReason === "aborted");

    if (errMsg) {
      ctx.ui.notify(
        `Fast command failed: ${errMsg.errorMessage ?? errMsg.stopReason}`,
        "error",
      );
    }

    const success = await pi.setModel(target);
    state = "idle";
    if (success) {
      ctx.ui.notify(`↩ Restored ${target.id}`, "info");
    }
  });

  // Reset state on session boundaries
  pi.on("session_start", () => {
    state = "idle";
    modelToRestore = undefined;
    activeCommand = "";
  });

  // Register each command
  for (const cmd of config.commands) {
    pi.registerCommand(cmd.name, {
      description: `${cmd.description} (fast model)`,
      handler: async (args: string, ctx: ExtensionCommandContext) => {
        // Mutex: reject if already in fast mode
        if (state !== "idle") {
          ctx.ui.notify(
            `Already running /${activeCommand} in fast mode — wait for it to finish`,
            "warning",
          );
          return;
        }

        await ctx.waitForIdle();
        const originalModel = ctx.model;

        // Try each fast model in order
        let fastModel: Model | undefined;
        for (const candidate of config.models) {
          const found = ctx.modelRegistry.find(candidate.provider, candidate.id);
          if (!found) continue;
          const switched = await pi.setModel(found);
          if (switched) { fastModel = found; break; }
          ctx.ui.notify(`No API key for ${candidate.id}, trying next…`, "info");
        }

        if (!fastModel) {
          ctx.ui.notify(
            `No fast model available. Tried: ${config.models.map(m => m.id).join(", ")}`,
            "error",
          );
          return;
        }

        // Enter fast mode
        state = "fast";
        activeCommand = cmd.name;
        modelToRestore = originalModel;

        // Show visual indicator
        ctx.ui.setWidget("fast-mode", (_tui, theme) => ({
          render() {
            return [theme.fg("warning", `⚡ fastmode`) + theme.fg("dim", ` ${fastModel!.id}`)];
          },
          invalidate() {},
        }), { placement: "aboveEditor" });

        ctx.ui.notify(`⚡ ${fastModel.id} → /${cmd.name}`, "info");
        pi.sendUserMessage(buildMessage(cmd, args));
      },
    });
  }

  // Shortcut: Ctrl+Shift+C for commit
  pi.registerShortcut("ctrl+shift+c", {
    description: "Quick commit (fast model)",
    handler: async () => {
      pi.sendUserMessage("/commit");
    },
  });
}
