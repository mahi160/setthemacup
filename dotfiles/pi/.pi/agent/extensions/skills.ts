import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { bus } from "./shared/bus.js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SKILL_DIRS = [
  join(homedir(), ".pi", "agent", "skills"),
  join(homedir(), ".agents", "skills"),
];

interface Skill {
  name: string;
  description: string;
  path: string;
  dir: string;
}

function parseFrontmatter(content: string): {
  name?: string;
  description?: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const meta: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { name: meta.name, description: meta.description };
}

function discoverSkills(): Skill[] {
  const skills: Skill[] = [];
  const seen = new Set<string>();

  for (const dir of SKILL_DIRS) {
    if (!existsSync(dir)) continue;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillMd = join(dir, entry.name, "SKILL.md");
        if (!existsSync(skillMd)) continue;

        const { name, description } = parseFrontmatter(
          readFileSync(skillMd, "utf-8"),
        );
        const skillName = name ?? entry.name;
        if (seen.has(skillName)) continue;
        seen.add(skillName);

        skills.push({
          name: skillName,
          description: description ?? "",
          path: skillMd,
          dir: join(dir, entry.name),
        });
      }
    } catch {
      /* skip unreadable dirs */
    }
  }

  return skills;
}

export default function (pi: ExtensionAPI): void {
  for (const skill of discoverSkills()) {
    pi.registerCommand(skill.name, {
      description: skill.description || `Run ${skill.name} skill`,
      handler: async (args) => {
        const content = readFileSync(skill.path, "utf-8");
        bus.emit("skill_invoked", { name: skill.name });
        pi.sendUserMessage(
          `[Skill directory: ${skill.dir}]\n` +
            `[Resolve all relative paths against the skill directory above]\n\n` +
            content +
            (args ? `\n\nUser: ${args}` : ""),
        );
      },
    });
  }
}
