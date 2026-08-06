export type ToolAliasPair = readonly [flatName: string, mcpName: string];

export interface CompanionSpec {
	dirName: string;
	packageName: string;
	aliases: ReadonlyArray<ToolAliasPair>;
}

/**
 * Core Claude Code tool names that always pass through Anthropic OAuth filtering.
 * Stored lowercase for case-insensitive matching.
 * Mirrors Pi core's claudeCodeTools list in packages/ai/src/providers/anthropic.ts
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

/** Known companion extensions and the tools they provide. */
export const COMPANIONS: CompanionSpec[] = [
	{
		dirName: "pi-web-access",
		packageName: "pi-web-access",
		aliases: [
			["web_search", "mcp__webaccess__web_search"],
			["code_search", "mcp__webaccess__code_search"],
			["fetch_content", "mcp__webaccess__fetch_content"],
			["get_search_content", "mcp__webaccess__get_search_content"],
		],
	},
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
	{
		dirName: "pi-extension",
		packageName: "@plannotator/pi-extension",
		aliases: [
			["plannotator_submit_plan", "mcp__plannotator__submit_plan"],
		],
	},
	{
		dirName: "ask-user",
		packageName: "ask-user",
		aliases: [
			["ask_user", "mcp__ask_user"],
		],
	},
	{
		dirName: "pi-coding-agent",
		packageName: "@earendil-works/pi-coding-agent",
		aliases: [
			["ask_user_question", "mcp__ask_user_question"],
		],
	},
];

/** Built-in flat companion tool name → MCP-style alias entries, derived from companion metadata. */
export const COMPANION_ALIAS_ENTRIES: ReadonlyArray<ToolAliasPair> = COMPANIONS.flatMap(
	(spec) => spec.aliases,
);

/** Reverse lookup: flat tool name → its companion spec. */
export const TOOL_TO_COMPANION = new Map<string, CompanionSpec>(
	COMPANIONS.flatMap((spec) => spec.aliases.map(([flat]) => [flat, spec] as const)),
);
