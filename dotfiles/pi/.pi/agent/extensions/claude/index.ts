import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerMcpAliases, syncAliasActivation } from "./aliases.js";
import { transformPayload } from "./payload.js";
import { unaliasToolCalls } from "./payload.js";
import { writeDebugLog } from "./debug.js";
import {
	CORE_TOOL_NAMES,
	COMPANIONS,
	COMPANION_ALIAS_ENTRIES,
	TOOL_TO_COMPANION,
	type ToolAliasPair,
} from "./companions.js";
import { registeredMcpAliases, autoActivatedAliases, getLastManagedToolList, setLastManagedToolList, MCP_TO_FLAT, FLAT_TO_MCP, refreshAliasMap } from "./state.js";
import { loadToolAliases, extractToolAliasPairs, readConfigFile } from "./config.js";
import { isPlainObject, lower } from "./helpers.js";
import {
	rewritePromptText,
	rewriteSystemField,
	remapBlockNames,
	collectToolNames,
	collectToolsByName,
	filterAndRemapTools,
	remapToolChoice,
	remapMessageToolNames,
} from "./payload.js";

export default async function piClaudeCodeUse(pi: ExtensionAPI): Promise<void> {
	pi.on("session_start", async (_event, ctx) => {
		await registerMcpAliases(pi, { cwd: ctx.cwd });
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		await registerMcpAliases(pi, { cwd: ctx.cwd });
		const model = ctx.model;
		const isOAuth = model?.provider === "anthropic" && ctx.modelRegistry.isUsingOAuth(model);
		syncAliasActivation(pi, isOAuth);
	});

	// MCP alias → flat canonical name before the agent loop resolves the tool.
	pi.on("message_end", async (event, _ctx) => {
		const rewritten = unaliasToolCalls(event.message, registeredMcpAliases);
		if (!rewritten) return undefined;
		return { message: rewritten as typeof event.message };
	});

	pi.on("before_provider_request", (event, ctx) => {
		const model = ctx.model;
		if (!model || model.provider !== "anthropic" || !ctx.modelRegistry.isUsingOAuth(model)) {
			return undefined;
		}
		if (!isPlainObject(event.payload)) {
			return undefined;
		}

		writeDebugLog({ stage: "before", payload: event.payload });
		const disableFilter = process.env.PI_CLAUDE_CODE_USE_DISABLE_TOOL_FILTER === "1";
		const transformed = transformPayload(event.payload as Record<string, unknown>, disableFilter);
		writeDebugLog({ stage: "after", payload: transformed });
		return transformed;
	});
}

// ============================================================================
// Test exports (preserve shape for any existing tests)
// ============================================================================

export const _test = {
	CORE_TOOL_NAMES,
	MCP_TO_FLAT,
	FLAT_TO_MCP,
	COMPANIONS,
	TOOL_TO_COMPANION,
	autoActivatedAliases,
	buildCaptureShim: undefined, // moved to aliases.ts, not exported
	collectToolNames,
	extractToolAliasPairs,
	filterAndRemapTools,
	getLastManagedToolList,
	isCompanionSource: undefined, // private in aliases.ts
	isPlainObject,
	loadToolAliases,
	lower,
	refreshAliasMap,
	registerMcpAliases,
	registeredMcpAliases,
	remapMessageToolNames,
	remapToolChoice,
	rewritePromptText,
	rewriteSystemField,
	setLastManagedToolList,
	syncAliasActivation,
	transformPayload,
	unaliasToolCalls,
};
