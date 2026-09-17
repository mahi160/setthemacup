import { CORE_TOOL_NAMES, TOOL_TO_COMPANION } from "./companions.js";
import { FLAT_TO_MCP, MCP_TO_FLAT } from "./state.js";
import { isPlainObject, lower } from "./helpers.js";

// ============================================================================
// System prompt rewrite (PRD §1.1)
//
// Replace "pi itself" → "the cli itself" in system prompt text.
// Preserves cache_control, non-text blocks, and payload shape.
// ============================================================================

export function rewritePromptText(text: string): string {
	return text
		.replaceAll("pi itself", "the cli itself")
		.replaceAll("pi .md files", "cli .md files")
		.replaceAll("pi packages", "cli packages");
}

export function rewriteSystemField(system: unknown): unknown {
	if (typeof system === "string") {
		return rewritePromptText(system);
	}
	if (!Array.isArray(system)) {
		return system;
	}
	return system.map((block) => {
		if (!isPlainObject(block) || block.type !== "text" || typeof block.text !== "string") {
			return block;
		}
		const rewritten = rewritePromptText(block.text);
		return rewritten === block.text ? block : { ...block, text: rewritten };
	});
}

// ============================================================================
// Tool filtering and MCP alias remapping (PRD §1.2)
// ============================================================================

export function remapBlockNames(
	content: unknown[],
	blockType: "tool_use" | "toolCall",
	mapName: (name: string) => string | undefined,
): unknown[] {
	let changed = false;
	const next = content.map((block) => {
		if (!isPlainObject(block) || block.type !== blockType || typeof block.name !== "string") {
			return block;
		}
		const newName = mapName(block.name);
		if (!newName || newName === block.name) return block;
		changed = true;
		return { ...block, name: newName };
	});
	return changed ? next : content;
}

export function collectToolNames(tools: unknown[]): Set<string> {
	const names = new Set<string>();
	for (const tool of tools) {
		if (isPlainObject(tool) && typeof tool.name === "string") {
			names.add(lower(tool.name));
		}
	}
	return names;
}

export function collectToolsByName(tools: unknown[]): Map<string, Record<string, unknown>> {
	const byName = new Map<string, Record<string, unknown>>();
	for (const tool of tools) {
		if (isPlainObject(tool) && typeof tool.name === "string") {
			byName.set(lower(tool.name), tool);
		}
	}
	return byName;
}

/**
 * Filter tools and remap companion tools to their MCP aliases.
 *
 * Rules applied per tool:
 * 1. Anthropic-native typed tools (have a `type` field) → pass through
 * 2. Core Claude Code tool names → pass through
 * 3. Tools already prefixed with mcp__ → pass through
 * 4. Known companion tools whose MCP alias is also advertised → rename to alias
 * 5. Known companion tools without an advertised alias → filtered out
 * 6. Unknown flat-named tools → filtered out (unless disableFilter)
 */
export function filterAndRemapTools(tools: unknown[] | undefined, disableFilter: boolean): unknown[] | undefined {
	if (!Array.isArray(tools)) return tools;

	const advertised = collectToolNames(tools);
	const toolsByName = collectToolsByName(tools);
	const emitted = new Set<string>();
	const result: unknown[] = [];

	for (const tool of tools) {
		if (!isPlainObject(tool)) continue;

		// Rule 1: native typed tools always pass through
		if (typeof tool.type === "string" && tool.type.trim().length > 0) {
			result.push(tool);
			continue;
		}

		const name = typeof tool.name === "string" ? tool.name : "";
		if (!name) continue;
		const nameLc = lower(name);

		// Rules 2 & 3: core tools and mcp__-prefixed pass through (with dedup)
		if (CORE_TOOL_NAMES.has(nameLc) || nameLc.startsWith("mcp__")) {
			if (!emitted.has(nameLc)) {
				emitted.add(nameLc);
				result.push(tool);
			}
			continue;
		}

		// Rules 4 & 5: known companion tool
		const mcpAlias = FLAT_TO_MCP.get(nameLc);
		if (mcpAlias) {
			const aliasLc = lower(mcpAlias);
			if (advertised.has(aliasLc) && !emitted.has(aliasLc)) {
				// Alias exists in tool list -> preserve its metadata, including cache_control.
				emitted.add(aliasLc);
				result.push(toolsByName.get(aliasLc) ?? { ...tool, name: mcpAlias });
			} else if (disableFilter && !emitted.has(nameLc)) {
				// Filter disabled: keep flat name if not yet emitted
				emitted.add(nameLc);
				result.push(tool);
			}
			continue;
		}

		// Rule 6: unknown flat-named tool
		if (disableFilter && !emitted.has(nameLc)) {
			emitted.add(nameLc);
			result.push(tool);
		}
	}

	return result;
}

export function remapToolChoice(
	toolChoice: Record<string, unknown>,
	survivingNames: Map<string, string>,
): Record<string, unknown> | undefined {
	if (toolChoice.type !== "tool" || typeof toolChoice.name !== "string") {
		return toolChoice;
	}

	const nameLc = lower(toolChoice.name);
	const actualName = survivingNames.get(nameLc);
	if (actualName) {
		return actualName === toolChoice.name ? toolChoice : { ...toolChoice, name: actualName };
	}

	const mcpAlias = FLAT_TO_MCP.get(nameLc);
	if (mcpAlias && survivingNames.has(lower(mcpAlias))) {
		return { ...toolChoice, name: mcpAlias };
	}

	return undefined;
}

export function remapMessageToolNames(messages: unknown[], survivingNames: Map<string, string>): unknown[] {
	let anyChanged = false;
	const result = messages.map((msg) => {
		if (!isPlainObject(msg) || !Array.isArray(msg.content)) return msg;
		const content = remapBlockNames(msg.content, "tool_use", (n) => {
			const alias = FLAT_TO_MCP.get(lower(n));
			return alias && survivingNames.has(lower(alias)) ? alias : undefined;
		});
		if (content === msg.content) return msg;
		anyChanged = true;
		return { ...msg, content };
	});
	return anyChanged ? result : messages;
}

export function unaliasToolCalls(message: unknown, registeredMcpAliases: Set<string>): unknown {
	if (!isPlainObject(message) || message.role !== "assistant" || !Array.isArray(message.content)) {
		return undefined;
	}
	const content = remapBlockNames(message.content, "toolCall", (n) => {
		const flat = MCP_TO_FLAT.get(lower(n));
		if (!flat || !registeredMcpAliases.has(lower(n))) return undefined;
		return flat;
	});
	return content === message.content ? undefined : { ...message, content };
}

/**
 * Full payload transform: rewrite system, filter tools, remap names.
 * Apply fix #6: drop upfront full clone, rely on copy-on-write instead.
 */
export function transformPayload(raw: Record<string, unknown>, disableFilter: boolean): Record<string, unknown> {
	// 1. System prompt rewrite (always applies) — returns same ref if unchanged
	const newSystem = raw.system !== undefined ? rewriteSystemField(raw.system) : undefined;
	let changed = newSystem !== raw.system;

	// When escape hatch is active, skip all tool filtering/remapping
	if (disableFilter) {
		if (!changed) return raw;
		return { ...raw, ...(newSystem !== undefined && { system: newSystem }) };
	}

	// 2. Tool filtering and alias remapping — returns same ref if unchanged
	const newTools = filterAndRemapTools(raw.tools as unknown[] | undefined, false);
	if (newTools !== raw.tools) changed = true;

	// 3. Build map of tool names that survived filtering (lowercase → actual name)
	const survivingNames = new Map<string, string>();
	if (Array.isArray(newTools)) {
		for (const tool of newTools) {
			if (isPlainObject(tool) && typeof tool.name === "string") {
				survivingNames.set(lower(tool.name), tool.name as string);
			}
		}
	}

	// 4. Remap tool_choice if it references a renamed or filtered tool
	let newToolChoice = raw.tool_choice;
	if (isPlainObject(raw.tool_choice)) {
		const remapped = remapToolChoice(raw.tool_choice, survivingNames);
		if (remapped === undefined) {
			newToolChoice = undefined;
			changed = true;
		} else if (remapped !== raw.tool_choice) {
			newToolChoice = remapped;
			changed = true;
		}
	}

	// 5. Rewrite historical tool_use blocks in message history
	let newMessages = raw.messages;
	if (Array.isArray(raw.messages)) {
		newMessages = remapMessageToolNames(raw.messages, survivingNames);
		if (newMessages !== raw.messages) changed = true;
	}

	if (!changed) return raw;

	return {
		...raw,
		...(newSystem !== raw.system && { system: newSystem }),
		...(newTools !== raw.tools && { tools: newTools }),
		...(newToolChoice !== raw.tool_choice && (newToolChoice === undefined ? {} : { tool_choice: newToolChoice })),
		...(newMessages !== raw.messages && { messages: newMessages }),
	};
}
