// https://github.com/ben-vargas/pi-packages/blob/main/packages/pi-claude-code-use/extensions/index.ts
import { appendFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { createJiti } from "jiti";
import * as piAgentCoreModule from "@earendil-works/pi-agent-core";
import * as piAiModule from "@earendil-works/pi-ai";
import * as piAiOauthModule from "@earendil-works/pi-ai/oauth";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import * as piCodingAgentModule from "@earendil-works/pi-coding-agent";
import * as piTuiModule from "@earendil-works/pi-tui";
import * as typeboxModule from "typebox";
import * as typeboxCompileModule from "typebox/compile";
import * as typeboxValueModule from "typebox/value";

// ============================================================================
// Types
// ============================================================================

interface CompanionSpec {
  dirName: string;
  packageName: string;
  aliases: ReadonlyArray<readonly [flatName: string, mcpName: string]>;
}

type ToolRegistration = Parameters<ExtensionAPI["registerTool"]>[0];
type ToolInfo = ReturnType<ExtensionAPI["getAllTools"]>[number];
type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>;
type JitiLoader = {
  import(path: string, opts?: { default?: boolean }): Promise<unknown>;
};

// ============================================================================
// Constants
// ============================================================================

const DEBUG_LOG_ENV = "PI_CLAUDE_CODE_USE_DEBUG_LOG";
const DISABLE_TOOL_FILTER_ENV = "PI_CLAUDE_CODE_USE_DISABLE_TOOL_FILTER";

/**
 * Core Claude Code tool names that always pass through Anthropic OAuth filtering.
 * Stored lowercase for case-insensitive matching.
 * Mirrors Pi core's claudeCodeTools list in packages/ai/src/providers/anthropic.ts
 */
const CORE_TOOL_NAMES = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "grep",
  "glob",
  "askuserquestion",
  "enterplanmode",
  "exitplanmode",
  "killshell",
  "notebookedit",
  "skill",
  "task",
  "taskoutput",
  "todowrite",
  "webfetch",
  "websearch",
]);

/** Flat companion tool name → MCP-style alias. */
const FLAT_TO_MCP = new Map<string, string>([
  ["web_search_exa", "mcp__exa__web_search"],
  ["get_code_context_exa", "mcp__exa__get_code_context"],
  ["firecrawl_scrape", "mcp__firecrawl__scrape"],
  ["firecrawl_map", "mcp__firecrawl__map"],
  ["firecrawl_search", "mcp__firecrawl__search"],
]);

/** MCP-style alias → flat companion tool name. */
const MCP_TO_FLAT = new Map<string, string>(
  [...FLAT_TO_MCP].map(([flat, mcp]) => [mcp, flat]),
);

/** Known companion extensions and the tools they provide. */
const COMPANIONS: CompanionSpec[] = [
  {
    dirName: "pi-exa-mcp",
    packageName: "@benvargas/pi-exa-mcp",
    aliases: [
      ["web_search_exa", "mcp__exa__web_search"],
      ["get_code_context_exa", "mcp__exa__get_code_context"],
    ],
  },
  {
    dirName: "pi-firecrawl",
    packageName: "@benvargas/pi-firecrawl",
    aliases: [
      ["firecrawl_scrape", "mcp__firecrawl__scrape"],
      ["firecrawl_map", "mcp__firecrawl__map"],
      ["firecrawl_search", "mcp__firecrawl__search"],
    ],
  },
];

/** Reverse lookup: flat tool name → its companion spec. */
const TOOL_TO_COMPANION = new Map<string, CompanionSpec>(
  COMPANIONS.flatMap((spec) =>
    spec.aliases.map(([flat]) => [flat, spec] as const),
  ),
);

const JITI_VIRTUAL_MODULES = {
  "@earendil-works/pi-agent-core": piAgentCoreModule,
  "@earendil-works/pi-ai": piAiModule,
  "@earendil-works/pi-ai/oauth": piAiOauthModule,
  "@earendil-works/pi-coding-agent": piCodingAgentModule,
  "@earendil-works/pi-tui": piTuiModule,

  // Back-compat for older companion packages that still import the old scope.
  "@mariozechner/pi-agent-core": piAgentCoreModule,
  "@mariozechner/pi-ai": piAiModule,
  "@mariozechner/pi-ai/oauth": piAiOauthModule,
  "@mariozechner/pi-coding-agent": piCodingAgentModule,
  "@mariozechner/pi-tui": piTuiModule,

  typebox: typeboxModule,
  "typebox/compile": typeboxCompileModule,
  "typebox/value": typeboxValueModule,
  "@sinclair/typebox": typeboxModule,
  "@sinclair/typebox/compile": typeboxCompileModule,
  "@sinclair/typebox/value": typeboxValueModule,
};

// ============================================================================
// Generic helpers
// ============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function lower(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

function setIfChanged<T extends Record<string, unknown>, K extends keyof T>(
  source: T,
  current: T,
  key: K,
  value: T[K],
): T {
  if (current[key] === value) return current;
  const target = current === source ? { ...source } : current;
  target[key] = value;
  return target;
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

// ============================================================================
// System prompt rewrite (PRD §1.1)
//
// Replace "pi itself" → "the cli itself" in system prompt text.
// Preserves cache_control, non-text blocks, and payload shape.
// ============================================================================

function rewritePromptText(text: string): string {
  return text
    .replaceAll("pi itself", "the cli itself")
    .replaceAll("pi .md files", "cli .md files")
    .replaceAll("pi packages", "cli packages");
}

function rewriteSystemField(system: unknown): unknown {
  if (typeof system === "string") {
    return rewritePromptText(system);
  }
  if (!Array.isArray(system)) {
    return system;
  }

  let changed = false;
  const blocks = system.map((block) => {
    if (
      !isPlainObject(block) ||
      block.type !== "text" ||
      typeof block.text !== "string"
    ) {
      return block;
    }

    const rewritten = rewritePromptText(block.text);
    if (rewritten === block.text) return block;

    changed = true;
    return { ...block, text: rewritten };
  });

  return changed ? blocks : system;
}

// ============================================================================
// Tool filtering and MCP alias remapping (PRD §1.2)
//
// Rules applied per tool:
// 1. Anthropic-native typed tools (have a `type` field) → pass through
// 2. Core Claude Code tool names → pass through
// 3. Tools already prefixed with mcp__ → pass through
// 4. Known companion tools whose MCP alias is also advertised → rename to alias
// 5. Known companion tools without an advertised alias → filtered out
// 6. Unknown flat-named tools → filtered out
// ============================================================================

function collectToolNames(tools: readonly unknown[]): Set<string> {
  const names = new Set<string>();
  for (const tool of tools) {
    if (isPlainObject(tool) && typeof tool.name === "string") {
      names.add(lower(tool.name));
    }
  }
  return names;
}

function collectToolsByName(
  tools: readonly unknown[],
): Map<string, Record<string, unknown>> {
  const byName = new Map<string, Record<string, unknown>>();
  for (const tool of tools) {
    if (isPlainObject(tool) && typeof tool.name === "string") {
      byName.set(lower(tool.name), tool);
    }
  }
  return byName;
}

function collectSurvivingToolNames(tools: unknown): Map<string, string> {
  const names = new Map<string, string>();
  if (!Array.isArray(tools)) return names;

  for (const tool of tools) {
    if (isPlainObject(tool) && typeof tool.name === "string") {
      names.set(lower(tool.name), tool.name);
    }
  }
  return names;
}

function filterAndRemapTools(
  tools: unknown[] | undefined,
): unknown[] | undefined {
  if (!Array.isArray(tools)) return tools;

  const advertised = collectToolNames(tools);
  const toolsByName = collectToolsByName(tools);
  const emitted = new Set<string>();
  const result: unknown[] = [];
  let changed = false;

  for (const tool of tools) {
    if (!isPlainObject(tool)) {
      changed = true;
      continue;
    }

    // Rule 1: native typed tools always pass through.
    if (typeof tool.type === "string" && tool.type.trim().length > 0) {
      result.push(tool);
      continue;
    }

    const name = typeof tool.name === "string" ? tool.name : "";
    if (!name) {
      changed = true;
      continue;
    }

    const nameLc = lower(name);

    // Rules 2 & 3: core tools and mcp__-prefixed tools pass through, deduped.
    if (CORE_TOOL_NAMES.has(nameLc) || nameLc.startsWith("mcp__")) {
      if (emitted.has(nameLc)) {
        changed = true;
        continue;
      }
      emitted.add(nameLc);
      result.push(tool);
      continue;
    }

    // Rules 4 & 5: known companion flat names survive only via advertised aliases.
    const mcpAlias = FLAT_TO_MCP.get(nameLc);
    if (mcpAlias) {
      const aliasLc = lower(mcpAlias);
      if (advertised.has(aliasLc) && !emitted.has(aliasLc)) {
        emitted.add(aliasLc);
        result.push(toolsByName.get(aliasLc) ?? { ...tool, name: mcpAlias });
      }
      changed = true;
      continue;
    }

    // Rule 6: unknown flat-named tools are filtered out.
    changed = true;
  }

  return changed ? result : tools;
}

function remapToolChoice(
  toolChoice: Record<string, unknown>,
  survivingNames: Map<string, string>,
): Record<string, unknown> | undefined {
  if (toolChoice.type !== "tool" || typeof toolChoice.name !== "string") {
    return toolChoice;
  }

  const nameLc = lower(toolChoice.name);
  const actualName = survivingNames.get(nameLc);
  if (actualName) {
    return actualName === toolChoice.name
      ? toolChoice
      : { ...toolChoice, name: actualName };
  }

  const mcpAlias = FLAT_TO_MCP.get(nameLc);
  if (mcpAlias && survivingNames.has(lower(mcpAlias))) {
    return { ...toolChoice, name: mcpAlias };
  }

  return undefined;
}

function remapMessageToolNames(
  messages: unknown[],
  survivingNames: Map<string, string>,
): unknown[] {
  let anyChanged = false;

  const result = messages.map((msg) => {
    if (!isPlainObject(msg) || !Array.isArray(msg.content)) return msg;

    let msgChanged = false;
    const content = (msg.content as unknown[]).map((block) => {
      if (
        !isPlainObject(block) ||
        block.type !== "tool_use" ||
        typeof block.name !== "string"
      ) {
        return block;
      }

      const mcpAlias = FLAT_TO_MCP.get(lower(block.name));
      if (mcpAlias && survivingNames.has(lower(mcpAlias))) {
        msgChanged = true;
        return { ...block, name: mcpAlias };
      }
      return block;
    });

    if (!msgChanged) return msg;

    anyChanged = true;
    return { ...msg, content };
  });

  return anyChanged ? result : messages;
}

// ============================================================================
// Full payload transform
// ============================================================================

function transformPayload(
  raw: Record<string, unknown>,
  disableFilter: boolean,
): Record<string, unknown> {
  let payload = raw;

  // 1. System prompt rewrite (always applies).
  if (raw.system !== undefined) {
    payload = setIfChanged(
      raw,
      payload,
      "system",
      rewriteSystemField(raw.system),
    );
  }

  // Escape hatch: keep tool payloads untouched, but still apply prompt rewrite.
  if (disableFilter) {
    return payload;
  }

  // 2. Tool filtering and alias remapping.
  if (Array.isArray(raw.tools)) {
    payload = setIfChanged(
      raw,
      payload,
      "tools",
      filterAndRemapTools(raw.tools),
    );
  }

  // 3. Build map of tool names that survived filtering (lowercase → actual name).
  const survivingNames = collectSurvivingToolNames(payload.tools);

  // 4. Remap tool_choice if it references a renamed or filtered tool.
  if (isPlainObject(payload.tool_choice)) {
    const remapped = remapToolChoice(payload.tool_choice, survivingNames);
    if (remapped === undefined) {
      if (payload === raw) payload = { ...raw };
      delete payload.tool_choice;
    } else {
      payload = setIfChanged(raw, payload, "tool_choice", remapped);
    }
  }

  // 5. Rewrite historical tool_use blocks in message history.
  if (Array.isArray(payload.messages)) {
    payload = setIfChanged(
      raw,
      payload,
      "messages",
      remapMessageToolNames(payload.messages, survivingNames),
    );
  }

  return payload;
}

// ============================================================================
// Debug logging (PRD §1.4)
// ============================================================================

function writeDebugLog(payload: unknown): void {
  const debugLogPath = process.env[DEBUG_LOG_ENV];
  if (!debugLogPath) return;

  try {
    appendFileSync(
      debugLogPath,
      `${new Date().toISOString()}\n${JSON.stringify(payload, null, 2)}\n---\n`,
      "utf-8",
    );
  } catch {
    // Debug logging must never break actual requests.
  }
}

// ============================================================================
// Companion alias registration (PRD §1.3)
//
// Discovers loaded companion extensions, captures their tool definitions via
// a shim ExtensionAPI, and registers MCP-alias versions so the model can
// invoke them under Claude Code-compatible names.
// ============================================================================

const registeredMcpAliases = new Set<string>();
const autoActivatedAliases = new Set<string>();
let lastManagedToolList: string[] | undefined;

const captureCache = new Map<string, Promise<Map<string, ToolRegistration>>>();
let jitiLoader: JitiLoader | undefined;
let aliasRegistration: Promise<void> | undefined;

/**
 * Monotonically-increasing counter bumped on every session_start.
 * In-flight alias registrations capture this value; if the session
 * has been replaced by the time they try to mutate state or call pi
 * APIs, they bail out instead of operating on a stale context.
 */
let sessionGeneration = 0;

function getJitiLoader(): JitiLoader {
  if (!jitiLoader) {
    jitiLoader = createJiti(import.meta.url, {
      moduleCache: false,
      tryNative: false,
      virtualModules: JITI_VIRTUAL_MODULES,
    }) as JitiLoader;
  }
  return jitiLoader;
}

function getFactoryCandidates(entryOrDir: string): string[] {
  const path = entryOrDir.replace(/\/$/, "");
  if (/\.[cm]?[jt]s$/.test(path)) {
    const dir = dirname(path);
    return [
      path,
      `${dir}/index.ts`,
      `${dir}/index.js`,
      `${dir}/extensions/index.ts`,
      `${dir}/extensions/index.js`,
    ];
  }

  return [
    `${path}/index.ts`,
    `${path}/index.js`,
    `${path}/extensions/index.ts`,
    `${path}/extensions/index.js`,
  ];
}

async function loadFactory(
  entryOrDir: string,
): Promise<ExtensionFactory | undefined> {
  const loader = getJitiLoader();
  for (const path of getFactoryCandidates(entryOrDir)) {
    try {
      const mod = await loader.import(path, { default: true });
      if (typeof mod === "function") return mod as ExtensionFactory;
    } catch {
      // Try next candidate.
    }
  }
  return undefined;
}

function isCompanionSource(
  tool: ToolInfo | undefined,
  spec: CompanionSpec,
): boolean {
  if (!tool?.sourceInfo) return false;

  const baseDir = tool.sourceInfo.baseDir;
  if (baseDir) {
    const dirName = basename(baseDir);
    if (dirName === spec.dirName) return true;
    if (
      dirName === "extensions" &&
      basename(dirname(baseDir)) === spec.dirName
    ) {
      return true;
    }
  }

  const fullPath = tool.sourceInfo.path;
  if (typeof fullPath !== "string") return false;

  // Normalize backslashes for Windows paths before segment-bounded checks.
  const normalized = fullPath.replaceAll("\\", "/");
  return (
    normalized.includes(`/${spec.packageName}/`) ||
    normalized.includes(`/${spec.dirName}/`)
  );
}

function buildCaptureShim(
  realPi: ExtensionAPI,
  captured: Map<string, ToolRegistration>,
): ExtensionAPI {
  const shimFlags = new Set<string>();

  return {
    registerTool(def) {
      captured.set(def.name, def as unknown as ToolRegistration);
    },
    registerFlag(name, _options) {
      shimFlags.add(name);
    },
    getFlag(name) {
      return shimFlags.has(name) ? realPi.getFlag(name) : undefined;
    },
    on() {},
    registerCommand() {},
    registerShortcut() {},
    registerMessageRenderer() {},
    registerProvider() {},
    unregisterProvider() {},
    sendMessage() {},
    sendUserMessage() {},
    appendEntry() {},
    setSessionName() {},
    getSessionName() {
      return undefined;
    },
    setLabel() {},
    exec(command, args, options) {
      return realPi.exec(command, args, options);
    },
    getActiveTools() {
      return realPi.getActiveTools();
    },
    getAllTools() {
      return realPi.getAllTools();
    },
    setActiveTools() {},
    getCommands() {
      return realPi.getCommands();
    },
    async setModel() {
      return false;
    },
    getThinkingLevel() {
      return realPi.getThinkingLevel();
    },
    setThinkingLevel() {},
    events: realPi.events,
  } as ExtensionAPI;
}

async function captureCompanionTools(
  entryOrDir: string,
  realPi: ExtensionAPI,
): Promise<Map<string, ToolRegistration>> {
  let pending = captureCache.get(entryOrDir);
  if (!pending) {
    pending = (async () => {
      const factory = await loadFactory(entryOrDir);
      if (!factory) return new Map<string, ToolRegistration>();

      const tools = new Map<string, ToolRegistration>();
      await factory(buildCaptureShim(realPi, tools));
      return tools;
    })();
    captureCache.set(entryOrDir, pending);
  }
  return pending;
}

async function doRegisterAliasesForLoadedCompanions(
  pi: ExtensionAPI,
): Promise<void> {
  // Snapshot the generation at the start of this async operation so we can
  // detect mid-flight session replacements and bail before touching stale state.
  const capturedGeneration = sessionGeneration;

  const allTools = pi.getAllTools();
  const toolIndex = new Map<string, ToolInfo>();
  const knownNames = new Set<string>();

  for (const tool of allTools) {
    toolIndex.set(lower(tool.name), tool);
    knownNames.add(lower(tool.name));
  }

  for (const spec of COMPANIONS) {
    for (const [flatName, mcpName] of spec.aliases) {
      const aliasLc = lower(mcpName);
      if (registeredMcpAliases.has(mcpName)) continue;

      if (knownNames.has(aliasLc)) {
        registeredMcpAliases.add(mcpName);
        continue;
      }

      const tool = toolIndex.get(lower(flatName));
      if (!tool || !isCompanionSource(tool, spec)) continue;

      // Prefer the concrete extension entry point when available. Falling back to
      // baseDir supports directory-style packages and monorepos.
      const loadTarget = tool.sourceInfo?.path ?? tool.sourceInfo?.baseDir;
      if (!loadTarget) continue;

      const captured = await captureCompanionTools(loadTarget, pi);
      const def = captured.get(flatName);
      if (!def) continue;

      // Bail if the session was replaced while we awaited async work above.
      if (capturedGeneration !== sessionGeneration) return;

      pi.registerTool({
        ...def,
        name: mcpName,
        label: def.label?.startsWith("MCP ")
          ? def.label
          : `MCP ${def.label ?? mcpName}`,
      });

      registeredMcpAliases.add(mcpName);
      knownNames.add(aliasLc);
    }
  }
}

function registerAliasesForLoadedCompanions(pi: ExtensionAPI): Promise<void> {
  aliasRegistration ??= doRegisterAliasesForLoadedCompanions(pi).finally(() => {
    aliasRegistration = undefined;
  });
  return aliasRegistration;
}

/**
 * Synchronize MCP alias tool activation with the current model state.
 * When OAuth is active, auto-activate aliases for any active companion tools.
 * When OAuth is inactive, remove auto-activated aliases (but preserve user-selected ones).
 */
function syncAliasActivation(pi: ExtensionAPI, enableAliases: boolean): void {
  const activeNames = pi.getActiveTools();
  const activeSet = new Set(activeNames);
  const allNames = new Set(pi.getAllTools().map((tool) => tool.name));

  if (enableAliases) {
    const activeLc = new Set(activeNames.map(lower));
    const desiredAliases = [...FLAT_TO_MCP].flatMap(([flat, mcp]) =>
      activeLc.has(flat) && allNames.has(mcp) && registeredMcpAliases.has(mcp)
        ? [mcp]
        : [],
    );
    const desiredSet = new Set(desiredAliases);

    // Promote auto-activated aliases to user-selected when the user explicitly kept
    // the alias while removing its flat counterpart from the tool picker.
    if (lastManagedToolList !== undefined) {
      const lastManaged = new Set(lastManagedToolList);
      for (const alias of autoActivatedAliases) {
        if (!activeSet.has(alias) || desiredSet.has(alias)) continue;

        const flatName = MCP_TO_FLAT.get(alias);
        if (flatName && lastManaged.has(flatName) && !activeSet.has(flatName)) {
          autoActivatedAliases.delete(alias);
        }
      }
    }

    const activeRegisteredAliases = activeNames.filter(
      (name) => registeredMcpAliases.has(name) && allNames.has(name),
    );

    // An alias is user-selected if it is active and was not auto-activated by us.
    const preservedAliases = activeRegisteredAliases.filter(
      (name) => !autoActivatedAliases.has(name),
    );

    const nonAliasTools = activeNames.filter(
      (name) => !registeredMcpAliases.has(name),
    );
    const next = Array.from(
      new Set([...nonAliasTools, ...preservedAliases, ...desiredAliases]),
    );

    const preservedSet = new Set(preservedAliases);
    autoActivatedAliases.clear();
    for (const name of desiredAliases) {
      if (!preservedSet.has(name)) autoActivatedAliases.add(name);
    }

    if (!sameStringArray(next, activeNames)) {
      pi.setActiveTools(next);
    }
    lastManagedToolList = [...next];
    return;
  }

  const next = activeNames.filter((name) => !autoActivatedAliases.has(name));
  autoActivatedAliases.clear();

  if (!sameStringArray(next, activeNames)) {
    pi.setActiveTools(next);
    lastManagedToolList = [...next];
  } else {
    lastManagedToolList = undefined;
  }
}

function isAnthropicOAuthModel(ctx: ExtensionContext): boolean {
  const model = ctx.model;
  return (
    model?.provider === "anthropic" && ctx.modelRegistry.isUsingOAuth(model)
  );
}

// ============================================================================
// Extension entry point
// ============================================================================

export default async function piClaudeCodeUse(pi: ExtensionAPI): Promise<void> {
  pi.on("session_start", async () => {
    // Bump the generation counter *first* so any in-flight doRegister…
    // call from the previous session detects the change and stops before
    // it touches the now-replaced pi or mutates freshly-cleared state.
    sessionGeneration++;

    // Clear stale module-level caches so each session gets fresh alias
    // registration. Without this, registeredMcpAliases retains entries from
    // the previous runtime, causing aliases to be skipped in new sessions.
    registeredMcpAliases.clear();
    autoActivatedAliases.clear();
    captureCache.clear();
    jitiLoader = undefined;
    lastManagedToolList = undefined;

    // Drop any pending alias-registration promise before starting a fresh one.
    // Without this reset, registerAliasesForLoadedCompanions(pi) would return
    // the old promise (via ??=), which holds a reference to the stale pi and
    // would throw "ctx is stale" when it eventually resolves and calls
    // pi.registerTool() on the replaced session's ExtensionAPI.
    aliasRegistration = undefined;

    await registerAliasesForLoadedCompanions(pi);
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    await registerAliasesForLoadedCompanions(pi);
    syncAliasActivation(pi, isAnthropicOAuthModel(ctx));
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!isAnthropicOAuthModel(ctx) || !isPlainObject(event.payload)) {
      return undefined;
    }

    writeDebugLog({ stage: "before", payload: event.payload });
    const transformed = transformPayload(
      event.payload,
      process.env[DISABLE_TOOL_FILTER_ENV] === "1",
    );
    writeDebugLog({ stage: "after", payload: transformed });
    return transformed;
  });
}

// ============================================================================
// Test exports
// ============================================================================

export const _test = {
  CORE_TOOL_NAMES,
  FLAT_TO_MCP,
  MCP_TO_FLAT,
  COMPANIONS,
  TOOL_TO_COMPANION,
  autoActivatedAliases,
  buildCaptureShim,
  collectSurvivingToolNames,
  collectToolNames,
  filterAndRemapTools,
  getFactoryCandidates,
  getLastManagedToolList: () => lastManagedToolList,
  isCompanionSource,
  isPlainObject,
  lower,
  registerAliasesForLoadedCompanions,
  registeredMcpAliases,
  remapMessageToolNames,
  remapToolChoice,
  rewritePromptText,
  rewriteSystemField,
  setLastManagedToolList: (value: string[] | undefined) => {
    lastManagedToolList = value;
  },
  syncAliasActivation,
  transformPayload,
};
