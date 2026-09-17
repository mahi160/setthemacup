/**
 * pi-focus: minimal memory commands.
 *
 * /remember <text>  - append a memory to ~/.pi/agent/memory.jsonl (no context injection)
 * /recall <query>   - keyword-search memory.jsonl, show top 5 (toast only, not sent to LLM)
 * /focus            - tiny "extension active" status
 */

import { appendFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MEMORY_FILE = join(homedir(), ".pi", "agent", "memory.jsonl");

interface MemoryEntry {
	timestamp: string;
	memory: string;
	cwd?: string;
}

async function appendMemory(entry: MemoryEntry): Promise<void> {
	await appendFile(MEMORY_FILE, `${JSON.stringify(entry)}\n`, { encoding: "utf8" }).catch(async (err) => {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
		const { mkdir } = await import("node:fs/promises");
		await mkdir(dirname(MEMORY_FILE), { recursive: true });
		await appendFile(MEMORY_FILE, `${JSON.stringify(entry)}\n`, "utf8");
	});
}

async function readMemories(): Promise<MemoryEntry[]> {
	let raw: string;
	try {
		raw = await readFile(MEMORY_FILE, "utf8");
	} catch {
		return [];
	}
	const entries: MemoryEntry[] = [];
	for (const line of raw.split("\n")) {
		if (!line.trim()) continue;
		try {
			entries.push(JSON.parse(line));
		} catch {
			// ponytail: skip a corrupted line rather than failing recall entirely
		}
	}
	return entries;
}

// ponytail: plain keyword substring match, no ranking/index — fine at jsonl-file scale
function keywordMatch(entries: MemoryEntry[], query: string, limit: number): MemoryEntry[] {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return [];
	return entries
		.filter((e) => {
			const haystack = e.memory.toLowerCase();
			return terms.some((t) => haystack.includes(t));
		})
		.slice(-limit)
		.reverse();
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("remember", {
		description: "Persist a memory outside the conversation (~/.pi/agent/memory.jsonl)",
		handler: async (args, ctx) => {
			const text = args.trim();
			if (!text) {
				ctx.ui.notify("Usage: /remember <text>", "warning");
				return;
			}
			await appendMemory({ timestamp: new Date().toISOString(), memory: text, cwd: ctx.cwd });
			ctx.ui.notify("Remembered.", "info");
		},
	});

	pi.registerCommand("recall", {
		description: "Search saved memories by keyword (top 5, shown only to you)",
		handler: async (args, ctx) => {
			const query = args.trim();
			if (!query) {
				ctx.ui.notify("Usage: /recall <query>", "warning");
				return;
			}
			const entries = await readMemories();
			const matches = keywordMatch(entries, query, 5);
			if (matches.length === 0) {
				ctx.ui.notify("No memories match.", "info");
				return;
			}
			const lines = matches.map((m) => `- ${m.memory}`);
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("focus", {
		description: "Show that pi-focus is active",
		handler: async (_args, ctx) => {
			ctx.ui.notify("pi-focus active: /remember /recall", "info");
		},
	});
}
