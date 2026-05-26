/**
 * web-search extension
 *
 * Registers two tools:
 *   - web_search   : search the web via Exa MCP (zero-config) or Brave API (if key set)
 *   - fetch_content: fetch and extract readable text from any URL
 *
 * Optional config in ~/.pi/web-search.json:
 * {
 *   "braveApiKey": "BSA...",   // Brave Search – 2000 free queries/month
 *   "exaApiKey":  "exa-..."   // Exa direct API – 1000 free queries/month
 * }
 *
 * Fallback chain (no config needed):
 *   Brave API key → Exa API key → Exa MCP (public, no key) → error
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ─── config ──────────────────────────────────────────────────────────────────

const CONFIG_PATH = join(homedir(), ".pi", "web-search.json");

interface Config {
	braveApiKey?: string;
	exaApiKey?: string;
}

function loadConfig(): Config {
	if (!existsSync(CONFIG_PATH)) return {};
	try {
		return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as Config;
	} catch {
		return {};
	}
}

// ─── search providers ─────────────────────────────────────────────────────────

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	published?: string;
}

interface SearchResponse {
	provider: string;
	results: SearchResult[];
}

// Brave Search API – 2000 free/month with free key
async function searchBrave(query: string, key: string, count: number): Promise<SearchResponse> {
	const url = new URL("https://api.search.brave.com/res/v1/web/search");
	url.searchParams.set("q", query);
	url.searchParams.set("count", String(count));
	url.searchParams.set("text_decorations", "false");
	url.searchParams.set("search_lang", "en");

	const res = await fetch(url.toString(), {
		headers: {
			"Accept": "application/json",
			"Accept-Encoding": "gzip",
			"X-Subscription-Token": key,
		},
	});

	if (!res.ok) {
		throw new Error(`Brave API error ${res.status}: ${await res.text()}`);
	}

	const data = (await res.json()) as {
		web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
	};

	const results: SearchResult[] = (data.web?.results ?? []).map((r) => ({
		title: r.title ?? "",
		url: r.url ?? "",
		snippet: r.description ?? "",
		published: r.age,
	}));

	return { provider: "brave", results };
}

// Exa direct API – 1000 free/month with free key
async function searchExaApi(query: string, key: string, count: number): Promise<SearchResponse> {
	const res = await fetch("https://api.exa.ai/search", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": key,
		},
		body: JSON.stringify({
			query,
			numResults: count,
			useAutoprompt: true,
		}),
	});

	if (!res.ok) {
		throw new Error(`Exa API error ${res.status}: ${await res.text()}`);
	}

	const data = (await res.json()) as {
		results?: Array<{ title?: string; url?: string; text?: string; publishedDate?: string }>;
	};

	const results: SearchResult[] = (data.results ?? []).map((r) => ({
		title: r.title ?? "",
		url: r.url ?? "",
		snippet: (r.text ?? "").slice(0, 300),
		published: r.publishedDate,
	}));

	return { provider: "exa-api", results };
}

// Exa MCP public relay – no key needed, ~1000/month soft limit
async function searchExaMcp(query: string, count: number): Promise<SearchResponse> {
	const res = await fetch("https://mcp.exa.ai/mcp", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json, text/event-stream",
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: {
				name: "web_search_exa",
				arguments: { query, numResults: count },
			},
		}),
	});

	if (!res.ok) {
		throw new Error(`Exa MCP error ${res.status}: ${await res.text()}`);
	}

	const body = await res.text();

	// Response is SSE – find data lines
	const dataLines = body.split("\n").filter((l) => l.startsWith("data:"));
	let parsed: { result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean }; error?: { message?: string } } | null = null;

	for (const line of dataLines) {
		const payload = line.slice(5).trim();
		if (!payload) continue;
		try {
			const candidate = JSON.parse(payload) as typeof parsed;
			if (candidate?.result || candidate?.error) {
				parsed = candidate;
				break;
			}
		} catch {
			// skip
		}
	}

	if (!parsed) throw new Error("Exa MCP: empty response");
	if (parsed.error) throw new Error(`Exa MCP: ${parsed.error.message}`);
	if (parsed.result?.isError) throw new Error("Exa MCP: tool returned error");

	const text = parsed.result?.content?.find((c) => c.type === "text")?.text ?? "[]";

	// Exa MCP returns a markdown-ish string; try JSON first, then parse text
	let results: SearchResult[] = [];
	try {
		const json = JSON.parse(text) as Array<{ title?: string; url?: string; text?: string; publishedDate?: string }>;
		results = json.map((r) => ({
			title: r.title ?? "",
			url: r.url ?? "",
			snippet: (r.text ?? "").slice(0, 300),
			published: r.publishedDate,
		}));
	} catch {
		// Parse plain text blocks like "Title: ...\nURL: ...\n"
		const blocks = text.split(/\n\n+/);
		for (const block of blocks) {
			const titleMatch = block.match(/Title:\s*(.+)/i);
			const urlMatch = block.match(/URL:\s*(https?:\/\/\S+)/i);
			const snippetMatch = block.match(/(?:Description|Snippet|Summary):\s*(.+)/i);
			if (urlMatch) {
				results.push({
					title: titleMatch?.[1]?.trim() ?? "",
					url: urlMatch[1].trim(),
					snippet: snippetMatch?.[1]?.trim() ?? "",
				});
			}
		}
	}

	return { provider: "exa-mcp", results };
}

// ─── fetch / extract ──────────────────────────────────────────────────────────

interface FetchResult {
	url: string;
	title: string;
	content: string;
	error: string | null;
}

async function fetchUrl(url: string): Promise<FetchResult> {
	// Try Exa MCP fetch first (free, no key)
	try {
		const res = await fetch("https://mcp.exa.ai/mcp", {
			method: "POST",
			headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
			body: JSON.stringify({
				jsonrpc: "2.0", id: 1, method: "tools/call",
				params: { name: "web_fetch_exa", arguments: { urls: [url], maxCharacters: 8000 } },
			}),
			signal: AbortSignal.timeout(15000),
		});
		if (res.ok) {
			const body = await res.text();
			const dataLine = body.split("\n").find((l) => l.startsWith("data:"));
			if (dataLine) {
				const parsed = JSON.parse(dataLine.slice(5)) as { result?: { content?: Array<{ type?: string; text?: string }> } };
				const text = parsed.result?.content?.find((c) => c.type === "text")?.text ?? "";
				if (text && !text.includes("isError")) {
					const titleMatch = text.match(/^#+\s*(.+)/m) ?? text.match(/Title:\s*(.+)/i);
					return { url, title: titleMatch?.[1]?.trim() ?? url, content: text.slice(0, 8000), error: null };
				}
			}
		}
	} catch {
		// fall through
	}

	// Try Jina Reader (free, no key)
	const jinaUrl = `https://r.jina.ai/${url}`;
	try {
		const res = await fetch(jinaUrl, {
			headers: { "Accept": "text/plain", "X-Return-Format": "markdown" },
			signal: AbortSignal.timeout(15000),
		});
		if (res.ok) {
			const text = await res.text();
			const titleMatch = text.match(/^Title:\s*(.+)/m);
			const content = text.replace(/^(Title:|URL Source:|Published Time:).+\n?/gm, "").trim();
			return { url, title: titleMatch?.[1]?.trim() ?? url, content: content.slice(0, 8000), error: null };
		}
	} catch {
		// fall through to raw fetch
	}

	// Fallback: raw fetch + strip HTML tags
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; pi-agent/1.0)" },
			signal: AbortSignal.timeout(10000),
		});

		if (!res.ok) {
			return { url, title: "", content: "", error: `HTTP ${res.status}` };
		}

		const html = await res.text();
		const text = html
			.replace(/<script[\s\S]*?<\/script>/gi, "")
			.replace(/<style[\s\S]*?<\/style>/gi, "")
			.replace(/<[^>]+>/g, " ")
			.replace(/\s{2,}/g, " ")
			.trim();

		const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

		return {
			url,
			title: titleMatch?.[1]?.trim() ?? url,
			content: text.slice(0, 8000),
			error: null,
		};
	} catch (err) {
		return {
			url,
			title: "",
			content: "",
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

// ─── extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── web_search ──
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description: [
			"Search the web and return a list of relevant results with titles, URLs, and snippets.",
			"Use for current events, documentation, facts, news, or anything requiring up-to-date information.",
			"Provider priority: Brave API (if key set) → Exa API (if key set) → Exa MCP (zero-config).",
			"Configure keys in ~/.pi/web-search.json: { \"braveApiKey\": \"...\", \"exaApiKey\": \"...\" }",
		].join(" "),
		parameters: Type.Object({
			query: Type.String({ description: "Search query" }),
			count: Type.Optional(
				Type.Number({ description: "Number of results to return (default: 8, max: 20)", minimum: 1, maximum: 20 })
			),
		}),
		async execute(_id, params, _signal) {
			const cfg = loadConfig();
			const count = Math.min(params.count ?? 8, 20);
			let response: SearchResponse;
			const errors: string[] = [];

			if (cfg.braveApiKey?.trim()) {
				try {
					response = await searchBrave(params.query, cfg.braveApiKey.trim(), count);
				} catch (err) {
					errors.push(`Brave: ${err instanceof Error ? err.message : String(err)}`);
					response = await searchExaMcp(params.query, count).catch((e) => {
						errors.push(`Exa MCP: ${e instanceof Error ? e.message : String(e)}`);
						throw new Error(`All providers failed:\n${errors.join("\n")}`);
					});
				}
			} else if (cfg.exaApiKey?.trim()) {
				try {
					response = await searchExaApi(params.query, cfg.exaApiKey.trim(), count);
				} catch (err) {
					errors.push(`Exa API: ${err instanceof Error ? err.message : String(err)}`);
					response = await searchExaMcp(params.query, count).catch((e) => {
						errors.push(`Exa MCP: ${e instanceof Error ? e.message : String(e)}`);
						throw new Error(`All providers failed:\n${errors.join("\n")}`);
					});
				}
			} else {
				response = await searchExaMcp(params.query, count);
			}

			const lines: string[] = [
				`Provider: ${response.provider}`,
				`Query: ${params.query}`,
				`Results: ${response.results.length}`,
				"",
			];

			for (const [i, r] of response.results.entries()) {
				lines.push(`[${i + 1}] ${r.title}`);
				lines.push(`    URL: ${r.url}`);
				if (r.published) lines.push(`    Published: ${r.published}`);
				if (r.snippet) lines.push(`    ${r.snippet}`);
				lines.push("");
			}

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: {},
			};
		},
	});

	// ── fetch_content ──
	pi.registerTool({
		name: "fetch_content",
		label: "Fetch Content",
		description: [
			"Fetch and extract readable content from a URL.",
			"Uses Jina Reader (r.jina.ai) for clean markdown extraction, falls back to raw HTML stripping.",
			"Good for reading articles, documentation, news pages, GitHub files, etc.",
			"Returns up to 8000 characters of extracted text.",
		].join(" "),
		parameters: Type.Object({
			url: Type.String({ description: "URL to fetch" }),
		}),
		async execute(_id, params, _signal) {
			const result = await fetchUrl(params.url);

			if (result.error) {
				return {
					content: [{ type: "text", text: `Error fetching ${params.url}: ${result.error}` }],
					details: {},
				};
			}

			const text = [
				`URL: ${result.url}`,
				`Title: ${result.title}`,
				"",
				result.content,
			].join("\n");

			return {
				content: [{ type: "text", text: text }],
				details: {},
			};
		},
	});
}
