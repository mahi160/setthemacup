import { isPlainObject, lower } from "./helpers.js";

/**
 * Claude Code tool names that pass through Anthropic OAuth unchanged (lowercase).
 * Mirrors pi-ai's claudeCodeTools list in api/anthropic-messages.
 */
export const CORE_TOOL_NAMES = new Set([
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

const ALIAS_PREFIX = "mcp__pi__";

/** Wire alias (lowercase) → pi tool name, from the latest transformed request. */
export const aliasToTool = new Map<string, string>();

// ============================================================================
// System prompt rewrite: "pi itself" → "the cli itself".
// Preserves cache_control, non-text blocks, and payload shape.
// ============================================================================

export function rewritePromptText(text: string): string {
	return text
		.replaceAll("pi itself", "the cli itself")
		.replaceAll("pi .md files", "cli .md files")
		.replaceAll("pi packages", "cli packages");
}

function rewriteSystemField<T>(system: T): T {
	if (typeof system === "string") return rewritePromptText(system) as T;
	if (!Array.isArray(system)) return system;
	return system.map((block) => {
		if (!isPlainObject(block) || block.type !== "text" || typeof block.text !== "string") return block;
		const rewritten = rewritePromptText(block.text);
		return rewritten === block.text ? block : { ...block, text: rewritten };
	}) as T;
}

// ============================================================================
// Tool renaming: non-Claude-Code tools go on the wire as MCP-style names.
// ============================================================================

/** Wire name for a pi tool name; undefined when it passes through as-is. */
function wireName(name: string): string | undefined {
	const nameLc = lower(name);
	if (CORE_TOOL_NAMES.has(nameLc) || nameLc.startsWith("mcp__")) return undefined;
	return `${ALIAS_PREFIX}${name}`;
}

function renameBlocks(content: unknown[], blockType: string, mapName: (name: string) => string | undefined): unknown[] {
	let changed = false;
	const next = content.map((block) => {
		if (!isPlainObject(block) || block.type !== blockType || typeof block.name !== "string") return block;
		const newName = mapName(block.name);
		if (!newName || newName === block.name) return block;
		changed = true;
		return { ...block, name: newName };
	});
	return changed ? next : content;
}

/** Rename tool definitions; drops later duplicates of an already-emitted wire name. */
export function renameTools(tools: unknown[]): unknown[] {
	const emitted = new Set<string>();
	const result: unknown[] = [];
	let changed = false;
	for (const tool of tools) {
		if (!isPlainObject(tool)) continue;
		// Anthropic-native typed tools pass through
		if (typeof tool.type === "string" && tool.type.trim().length > 0) {
			result.push(tool);
			continue;
		}
		if (typeof tool.name !== "string" || !tool.name) continue;
		const alias = wireName(tool.name);
		const outName = alias ?? tool.name;
		const outLc = lower(outName);
		if (emitted.has(outLc)) {
			changed = true;
			continue;
		}
		emitted.add(outLc);
		if (alias) {
			aliasToTool.set(outLc, tool.name);
			changed = true;
			result.push({ ...tool, name: alias });
		} else {
			result.push(tool);
		}
	}
	return changed ? result : tools;
}

function renameToolChoice<T>(toolChoice: T): T {
	if (!isPlainObject(toolChoice) || toolChoice.type !== "tool" || typeof toolChoice.name !== "string") return toolChoice;
	const alias = wireName(toolChoice.name);
	return alias ? ({ ...toolChoice, name: alias } as T) : toolChoice;
}

function renameHistory(messages: unknown[]): unknown[] {
	let changed = false;
	const next = messages.map((msg) => {
		if (!isPlainObject(msg) || !Array.isArray(msg.content)) return msg;
		const content = renameBlocks(msg.content, "tool_use", wireName);
		if (content === msg.content) return msg;
		changed = true;
		return { ...msg, content };
	});
	return changed ? next : messages;
}

/** Map aliased tool calls in an assistant message back to pi tool names. */
export function unaliasToolCalls<T>(message: T): T | undefined {
	if (!isPlainObject(message) || message.role !== "assistant" || !Array.isArray(message.content)) return undefined;
	const content = renameBlocks(message.content, "toolCall", (n) => aliasToTool.get(lower(n)));
	return content === message.content ? undefined : ({ ...message, content } as T);
}

/** Full payload transform. Copy-on-write: returns `raw` when nothing changed. */
export function transformPayload(raw: Record<string, unknown>, renameEnabled: boolean): Record<string, unknown> {
	const system = raw.system !== undefined ? rewriteSystemField(raw.system) : raw.system;
	const tools = renameEnabled && Array.isArray(raw.tools) ? renameTools(raw.tools) : raw.tools;
	const toolChoice = renameEnabled ? renameToolChoice(raw.tool_choice) : raw.tool_choice;
	const messages = renameEnabled && Array.isArray(raw.messages) ? renameHistory(raw.messages) : raw.messages;

	if (system === raw.system && tools === raw.tools && toolChoice === raw.tool_choice && messages === raw.messages) {
		return raw;
	}
	return { ...raw, system, tools, tool_choice: toolChoice, messages };
}
