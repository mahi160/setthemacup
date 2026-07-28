import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { isPlainObject } from "./helpers.js";
import type { ToolAliasPair } from "./companions.js";

export const CONFIG_FILENAME = "pi-claude-code-use.json";

/**
 * User-defined tool aliases via pi-claude-code-use.json
 *
 * Lookup order:
 *   1. Project-level: <cwd>/.pi/extensions/pi-claude-code-use.json
 *   2. Global: <agentDir>/extensions/claude/pi-claude-code-use.json
 *
 * Project file's keys replace global file's via spread-merge.
 * Schema: { "toolAliases": [[flat, mcp], ...] }
 */

export function readConfigFile(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {};
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
		return isPlainObject(parsed) ? parsed : {};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[pi-claude-code-use] Failed to read ${filePath}: ${message}`);
		return {};
	}
}

/**
 * Extract tool alias pairs from a config object.
 * Returns `undefined` when `toolAliases` is missing or not an array;
 * returns `[]` for an explicit empty array (which disables inherited globals).
 */
export function extractToolAliasPairs(value: unknown): ToolAliasPair[] | undefined {
	if (!isPlainObject(value)) return undefined;
	const raw = (value as { toolAliases?: unknown }).toolAliases;
	if (raw === undefined) return undefined;
	if (!Array.isArray(raw)) {
		console.warn(`[pi-claude-code-use] Ignoring "toolAliases": expected array, got ${typeof raw}`);
		return undefined;
	}
	return raw.filter(
		(e): e is ToolAliasPair => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string",
	);
}

export function loadToolAliases(cwd: string, agentDir: string = getAgentDir()): ToolAliasPair[] {
	const globalPath = join(agentDir, "extensions", "claude", CONFIG_FILENAME);
	const projectPath = join(cwd, ".pi", "extensions", CONFIG_FILENAME);
	const merged = { ...readConfigFile(globalPath), ...readConfigFile(projectPath) };
	return extractToolAliasPairs(merged) ?? [];
}
