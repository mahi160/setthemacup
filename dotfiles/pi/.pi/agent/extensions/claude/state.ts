import { COMPANION_ALIAS_ENTRIES } from "./companions.js";
import { lower } from "./helpers.js";
import type { ToolAliasPair } from "./companions.js";

/** Flat tool name (lowercase) → MCP-style alias. Rebuilt from built-in companions plus current user config. */
export const FLAT_TO_MCP = new Map<string, string>(
	COMPANION_ALIAS_ENTRIES.map(([flat, mcp]) => [lower(flat), mcp]),
);

/** Reverse lookup: MCP-prefixed alias (lowercase) → canonical flat name. */
export const MCP_TO_FLAT = new Map<string, string>(
	COMPANION_ALIAS_ENTRIES.map(([flat, mcp]) => [lower(mcp), flat]),
);

/** Registered MCP aliases (lowercase) — only these are rewritten back at message_end. */
export const registeredMcpAliases = new Set<string>();

/** MCP aliases that were auto-activated (not user-selected). */
export const autoActivatedAliases = new Set<string>();

/** Last managed tool list for user-selection tracking. */
let _lastManagedToolList: string[] | undefined;

export function getLastManagedToolList(): string[] | undefined {
	return _lastManagedToolList;
}

export function setLastManagedToolList(list: string[] | undefined): void {
	_lastManagedToolList = list;
}

export function refreshAliasMap(userToolAliases: ToolAliasPair[]): void {
	FLAT_TO_MCP.clear();
	MCP_TO_FLAT.clear();
	for (const [flat, mcp] of COMPANION_ALIAS_ENTRIES) {
		FLAT_TO_MCP.set(lower(flat), mcp);
		MCP_TO_FLAT.set(lower(mcp), flat);
	}
	for (const [flat, mcp] of userToolAliases) {
		FLAT_TO_MCP.set(lower(flat), mcp);
		MCP_TO_FLAT.set(lower(mcp), flat);
	}
}
