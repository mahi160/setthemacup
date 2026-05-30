/**
 * agents — Unified extension for fast commands, tools, and custom subagents.
 *
 * Consolidates:
 * - Fast commands: /commit, /pr, /standup, /review, /test (user-facing)
 * - Tools: scout, review, tests, security (LLM can call as tools)
 * - Custom: /sub command + custom_agent tool (access both fast commands + templates)
 *
 * All driven by two config files:
 * - fast-commands.json: full agent config for /commit, /pr, /standup, /review, /test
 * - subagents.json: template agents (scout, review, tests, security) + models
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCommands, type FastCommand } from "./handlers/command";
import { registerTools } from "./handlers/tool";
import { registerCustom } from "./handlers/custom";
import type { SubagentConfig, Model } from "../shared/spawn-subagent";

// ── Config loading ─────────────────────────────────────────────────────────────

// FastCommand now has full agent config (not just routing metadata)
export interface FastCommandConfig {
  commands: FastCommand[];
}

// SubagentConfig has templates and models
export interface SubagentConfigFull {
  models: Model[];
  agents: (SubagentConfig & { promptGuidelines?: string[] })[];
}

const configDir = join(fileURLToPath(new URL(".", import.meta.url)), "config");

/**
 * If an entry has `promptFile`, load the .md file and set `prompt`.
 * Falls back to inline `prompt` if file is missing.
 */
function resolvePromptFile<T extends { prompt?: string | string[]; promptFile?: string }>(entry: T): T {
  if (!entry.promptFile) return entry;
  const filePath = join(configDir, entry.promptFile);
  if (!existsSync(filePath)) {
    console.warn(`[agents] promptFile not found: ${filePath}`);
    return entry;
  }
  return { ...entry, prompt: readFileSync(filePath, "utf-8").trim() };
}

let fastCmdConfig: FastCommandConfig;
try {
  const raw = JSON.parse(readFileSync(join(configDir, "fast-commands.json"), "utf-8")) as FastCommandConfig;
  fastCmdConfig = { commands: raw.commands.map(resolvePromptFile) };
} catch (err) {
  console.warn("[agents] fast-commands.json not found:", err);
  fastCmdConfig = { commands: [] };
}

let subagentConfig: SubagentConfigFull;
try {
  const raw = JSON.parse(readFileSync(join(configDir, "subagents.json"), "utf-8")) as SubagentConfigFull;
  subagentConfig = { models: raw.models, agents: raw.agents.map(resolvePromptFile) };
} catch (err) {
  console.warn("[agents] subagents.json not found:", err);
  subagentConfig = { models: [], agents: [] };
}

// ── Extension ──────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  const { commands } = fastCmdConfig;
  const { models, agents } = subagentConfig;

  if (!models.length) {
    console.warn("[agents] No models configured in subagents.json");
  }

  if (!commands.length && !agents.length) {
    console.warn("[agents] No commands or agents configured");
  }

  // Register handlers
  // Fast commands use their full config from fast-commands.json
  registerCommands(pi, commands, models);
  // Tools use template agents from subagents.json
  registerTools(pi, agents, models);
  // Custom subagent can access both fast commands and templates
  registerCustom(pi, commands, agents, models);

  console.log(
    `[agents] Loaded: ${commands.length} fast commands, ${agents.length} template agents`,
  );
}
