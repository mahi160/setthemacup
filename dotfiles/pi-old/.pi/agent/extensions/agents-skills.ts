/**
 * agents-skills.ts — expose ~/.agents/skills to pi's native skill loader.
 *
 * pi already turns every discovered SKILL.md into a `/skill:<name>` command
 * (settings.json: enableSkillCommands, default true) — it just doesn't look
 * outside `agentDir/skills`. This hooks the resources_discover event to add
 * ~/.agents/skills as an extra skill root, so every skill under it gets its
 * own `/skill:name` command for free. No custom command registration needed.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SKILLS_DIR = join(homedir(), ".agents", "skills");

export default function (pi: ExtensionAPI): void {
  pi.on("resources_discover", () => ({ skillPaths: [SKILLS_DIR] }));
}
