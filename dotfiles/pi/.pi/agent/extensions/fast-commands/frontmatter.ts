/**
 * fast-commands/frontmatter.ts — tiny flat-key frontmatter parser for the
 * agents/*.md files (name/description/tools/model/thinking/output/icon).
 * No YAML lib: every field here is a single-line scalar, a one-line regex
 * per field is all this needs.
 */

export interface LoadedAgent {
  name: string;
  description: string;
  tools: string[];
  model: string;
  thinking: string;
  output: "notify" | "inline";
  icon: string;
  prompt: string;
}

const FIELD_RE = /^([A-Za-z][\w-]*):\s*(.*)$/;

export function parseAgentFile(raw: string, fallbackName: string): LoadedAgent {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`no frontmatter block in agent file for "${fallbackName}"`);
  const [, frontmatter, body] = match;
  const fields: Record<string, string> = {};
  for (const line of frontmatter!.split("\n")) {
    const fieldMatch = line.match(FIELD_RE);
    if (fieldMatch) fields[fieldMatch[1]!] = fieldMatch[2]!.trim();
  }
  return {
    name: fields.name || fallbackName,
    description: fields.description || "",
    tools: (fields.tools || "").split(",").map((t) => t.trim()).filter(Boolean),
    model: fields.model || "anthropic/claude-haiku-4-5",
    thinking: fields.thinking || "off",
    output: fields.output === "inline" ? "inline" : "notify",
    icon: fields.icon || "󰚩",
    prompt: body!.trim(),
  };
}

// ── Self-check ───────────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith("frontmatter.ts")) {
  const sample = `---\nname: commit\ndescription: Do the thing\ntools: bash, read\nmodel: anthropic/claude-haiku-4-5\nthinking: off\noutput: notify\nicon: X\n---\nBody line 1.\nBody line 2.`;
  const parsed = parseAgentFile(sample, "fallback");
  console.assert(parsed.name === "commit", "name parsed");
  console.assert(parsed.tools.length === 2 && parsed.tools[1] === "read", "tools split");
  console.assert(parsed.output === "notify", "output default parsed");
  console.assert(parsed.prompt === "Body line 1.\nBody line 2.", "body trimmed");
  console.log("frontmatter self-check: OK");
}
