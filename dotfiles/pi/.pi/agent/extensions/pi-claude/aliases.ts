import { basename, dirname } from "node:path";
import { createJiti } from "@mariozechner/jiti";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as piAgentCoreModule from "@earendil-works/pi-agent-core";
import * as piAiModule from "@earendil-works/pi-ai";
import * as piAiOauthModule from "@earendil-works/pi-ai/oauth";
import * as piCodingAgentModule from "@earendil-works/pi-coding-agent";
import * as piTuiModule from "@earendil-works/pi-tui";
import * as typeboxModule from "typebox";
import * as typeboxCompileModule from "typebox/compile";
import * as typeboxValueModule from "typebox/value";

import { COMPANIONS, type CompanionSpec } from "./companions.js";
import { loadToolAliases, CONFIG_FILENAME } from "./config.js";
import {
	FLAT_TO_MCP,
	MCP_TO_FLAT,
	registeredMcpAliases,
	autoActivatedAliases,
	getLastManagedToolList,
	setLastManagedToolList,
	refreshAliasMap,
} from "./state.js";
import { lower } from "./helpers.js";

type ToolRegistration = Parameters<ExtensionAPI["registerTool"]>[0];
type ToolInfo = ReturnType<ExtensionAPI["getAllTools"]>[number];

// ============================================================================
// jiti loader with virtual modules (fix #5: isolated in this module)
// ============================================================================

let jitiLoader: { import(path: string, opts?: { default?: boolean }): Promise<unknown> } | undefined;
let captureCache = new Map<string, Promise<Map<string, ToolRegistration>>>();
let captureConfigVersion = 0;
let lastConfigVersion = 0;

function getJitiLoader() {
	if (!jitiLoader) {
		jitiLoader = createJiti(import.meta.url, {
			moduleCache: false,
			tryNative: false,
			virtualModules: {
				"@earendil-works/pi-agent-core": piAgentCoreModule,
				"@earendil-works/pi-ai": piAiModule,
				"@earendil-works/pi-ai/oauth": piAiOauthModule,
				"@earendil-works/pi-coding-agent": piCodingAgentModule,
				"@earendil-works/pi-tui": piTuiModule,
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
			},
		});
	}
	return jitiLoader;
}

async function loadFactory(baseDir: string): Promise<((pi: ExtensionAPI) => void | Promise<void>) | undefined> {
	const dir = baseDir.replace(/\/$/, "");
	const candidates = [`${dir}/index.ts`, `${dir}/index.js`, `${dir}/extensions/index.ts`, `${dir}/extensions/index.js`];

	const loader = getJitiLoader();
	for (const path of candidates) {
		try {
			const mod = await loader.import(path, { default: true });
			if (typeof mod === "function") return mod as (pi: ExtensionAPI) => void | Promise<void>;
		} catch {
			// Try next candidate
		}
	}
	return undefined;
}

function buildCaptureShim(realPi: ExtensionAPI, captured: Map<string, ToolRegistration>): ExtensionAPI {
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
		setActiveTools(names) {
			realPi.setActiveTools(names);
		},
		getCommands() {
			return realPi.getCommands();
		},
		setModel(model) {
			return realPi.setModel(model);
		},
		getThinkingLevel() {
			return realPi.getThinkingLevel();
		},
		setThinkingLevel(level) {
			realPi.setThinkingLevel(level);
		},
		events: realPi.events,
	} as ExtensionAPI;
}

async function captureCompanionTools(baseDir: string, realPi: ExtensionAPI): Promise<Map<string, ToolRegistration>> {
	let pending = captureCache.get(baseDir);
	if (!pending) {
		pending = (async () => {
			const factory = await loadFactory(baseDir);
			if (!factory) return new Map<string, ToolRegistration>();
			const tools = new Map<string, ToolRegistration>();
			await factory(buildCaptureShim(realPi, tools));
			return tools;
		})();
		captureCache.set(baseDir, pending);
	}
	return pending;
}

function isCompanionSource(tool: ToolInfo | undefined, spec: CompanionSpec): boolean {
	if (!tool?.sourceInfo) return false;

	const baseDir = tool.sourceInfo.baseDir;
	if (baseDir) {
		const dirName = basename(baseDir);
		if (dirName === spec.dirName) return true;
		if (dirName === "extensions" && basename(dirname(baseDir)) === spec.dirName) return true;
	}

	const fullPath = tool.sourceInfo.path;
	if (typeof fullPath !== "string") return false;
	const normalized = fullPath.replaceAll("\\", "/");
	return normalized.includes(`/${spec.packageName}/`) || normalized.includes(`/${spec.dirName}/`);
}

/**
 * Signals that config has changed and cache should be cleared on next registerMcpAliases.
 * Apply fix #5: only clear jiti cache when config actually changes, not every turn.
 */
export function invalidateAliasCache(): void {
	captureConfigVersion++;
}

/**
 * Register MCP aliases for all known companion tools (from COMPANIONS + user config).
 * Apply fix #5: only re-capture when config version changes; per-turn path is cheap.
 */
export async function registerMcpAliases(pi: ExtensionAPI, opts: { cwd?: string; agentDir?: string } = {}): Promise<void> {
	// Only clear cache if config changed since last call
	if (lastConfigVersion !== captureConfigVersion) {
		captureCache.clear();
		lastConfigVersion = captureConfigVersion;
	}

	// Pick up user-defined tool aliases from settings.json
	const userToolAliases = loadToolAliases(opts.cwd ?? process.cwd(), opts.agentDir);
	refreshAliasMap(userToolAliases);

	const allTools = pi.getAllTools();
	const toolIndex = new Map<string, ToolInfo>();
	const knownNames = new Set<string>();
	for (const tool of allTools) {
		toolIndex.set(lower(tool.name), tool);
		knownNames.add(lower(tool.name));
	}

	// Loads the source extension via jiti and re-registers its captured tool
	// definition under `mcpName`. Skips if already registered or unloadable.
	const registerMcpAlias = async (tool: ToolInfo | undefined, flatName: string, mcpName: string): Promise<void> => {
		if (!tool || registeredMcpAliases.has(lower(mcpName)) || knownNames.has(lower(mcpName))) return;
		const loadDir = tool.sourceInfo?.path ? dirname(tool.sourceInfo.path) : tool.sourceInfo?.baseDir;
		if (!loadDir) return;
		const def = (await captureCompanionTools(loadDir, pi)).get(flatName);
		if (!def) return;
		pi.registerTool({
			...def,
			name: mcpName,
			label: def.label?.startsWith("MCP ") ? def.label : `MCP ${def.label ?? mcpName}`,
		});
		registeredMcpAliases.add(lower(mcpName));
		knownNames.add(lower(mcpName));
	};

	// Built-in companion aliases: gated by source-info match against COMPANIONS.
	for (const spec of COMPANIONS) {
		for (const [flatName, mcpName] of spec.aliases) {
			const tool = toolIndex.get(lower(flatName));
			if (tool && !isCompanionSource(tool, spec)) continue;
			await registerMcpAlias(tool, flatName, mcpName);
		}
	}

	// User-defined aliases: matched by flat name only.
	for (const [flatName, mcpName] of userToolAliases) {
		await registerMcpAlias(toolIndex.get(lower(flatName)), flatName, mcpName);
	}
}

/**
 * Synchronize MCP alias tool activation with the current model state.
 * When OAuth is active, auto-activate aliases for any active companion tools.
 * When OAuth is inactive, remove auto-activated aliases (but preserve user-selected ones).
 */
export function syncAliasActivation(pi: ExtensionAPI, enableAliases: boolean): void {
	const activeNames = pi.getActiveTools();
	const allNames = new Set(pi.getAllTools().map((t) => t.name));

	if (enableAliases) {
		// Determine which aliases should be active based on their flat counterpart being active
		const activeLc = new Set(activeNames.map(lower));
		const desiredAliases: string[] = [];
		for (const [flat, mcp] of FLAT_TO_MCP) {
			if (activeLc.has(flat) && allNames.has(mcp) && registeredMcpAliases.has(lower(mcp))) {
				desiredAliases.push(mcp);
			}
		}
		const desiredSet = new Set(desiredAliases);

		// Promote auto-activated aliases to user-selected when the user explicitly kept
		// the alias while removing its flat counterpart from the tool picker.
		const lastManaged = getLastManagedToolList();
		if (lastManaged !== undefined) {
			const activeSet = new Set(activeNames);
			const lastManagedSet = new Set(lastManaged);
			for (const alias of autoActivatedAliases) {
				if (!activeSet.has(alias) || desiredSet.has(alias)) continue;
				// Find the flat name for this alias
				const flatName = [...FLAT_TO_MCP.entries()].find(([, mcp]) => mcp === alias)?.[0];
				if (flatName && lastManagedSet.has(flatName) && !activeSet.has(flatName)) {
					// User removed the flat tool but kept the alias → promote to user-selected
					autoActivatedAliases.delete(alias);
				}
			}
		}

		// Find registered aliases currently in the active list
		const activeRegistered = activeNames.filter((n) => registeredMcpAliases.has(lower(n)) && allNames.has(n));

		// Per-alias provenance: an alias is "user-selected" if it's active and was NOT
		// auto-activated by us. Only preserve those; auto-activated aliases get re-derived
		// from the desired set each sync.
		const preserved = activeRegistered.filter((n) => !autoActivatedAliases.has(n));

		// Build result: non-alias tools + preserved user aliases + desired aliases
		const nonAlias = activeNames.filter((n) => !registeredMcpAliases.has(lower(n)));
		const next = Array.from(new Set([...nonAlias, ...preserved, ...desiredAliases]));

		// Update auto-activation tracking: aliases we added this sync that weren't user-preserved
		const preservedSet = new Set(preserved);
		const newAutoActivated = new Set<string>();
		for (const name of desiredAliases) {
			if (!preservedSet.has(name)) {
				newAutoActivated.add(name);
			}
		}
		autoActivatedAliases.clear();
		for (const alias of newAutoActivated) {
			autoActivatedAliases.add(alias);
		}

		if (next.length !== activeNames.length || next.some((n, i) => n !== activeNames[i])) {
			pi.setActiveTools(next);
			setLastManagedToolList([...next]);
		}
	} else {
		// Remove only auto-activated aliases; user-selected ones are preserved
		const next = activeNames.filter((n) => !autoActivatedAliases.has(n));
		autoActivatedAliases.clear();

		if (next.length !== activeNames.length || next.some((n, i) => n !== activeNames[i])) {
			pi.setActiveTools(next);
			setLastManagedToolList([...next]);
		} else {
			setLastManagedToolList(undefined);
		}
	}
}

// Test exports for checking internal state
export const _captureCache = captureCache;
export const _invalidateAliasCache = invalidateAliasCache;
