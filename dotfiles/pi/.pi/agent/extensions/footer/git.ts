import { execFileSync } from "node:child_process";

let _gitDirtyCache = "";
let _gitDirtyAt = 0;
let _isGitRepo: boolean | undefined;
let _lastCwd: string | undefined;

export function getGitDirty(cwd: string): string {
  if (cwd !== _lastCwd) {
    _lastCwd = cwd;
    resetGitCache();
  }
  if (_isGitRepo === false) return "";
  const now = Date.now();
  if (now - _gitDirtyAt < 10_000) return _gitDirtyCache;
  _gitDirtyAt = now;
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
      timeout: 3_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    _isGitRepo = true;
    if (!out) {
      _gitDirtyCache = "";
      return "";
    }
    let staged = 0,
      unstaged = 0;
    for (const line of out.split("\n")) {
      if (!line) continue;
      if (line[0] === "?" && line[1] === "?") continue;
      if (line[0] !== " ") staged++;
      if (line[1] !== " ") unstaged++;
    }
    const parts: string[] = [];
    if (staged) parts.push(`+${staged}`);
    if (unstaged) parts.push(`~${unstaged}`);
    _gitDirtyCache = parts.join(" ");
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("not a git repository"))
      _isGitRepo = false;
    _gitDirtyCache = "";
  }
  return _gitDirtyCache;
}

export function resetGitCache(): void {
  _gitDirtyCache = "";
  _isGitRepo = undefined;
}
