import { execFile, execFileSync } from "node:child_process";

const DIRTY_TTL_MS = 10_000;
const BRANCH_TTL_MS = 5_000;

function safeCwd(cwd: string | undefined): string {
  return cwd || process.cwd();
}

/** TTL-cached value refreshed async via `git <args>`, keyed by cwd. */
function cachedGit(ttlMs: number, args: string[], parse: (stdout: string) => string) {
  let value = "";
  let at = 0;
  let cwd: string | undefined;
  let inFlight = false;

  function get(newCwd: string | undefined): string {
    const dir = safeCwd(newCwd);
    if (dir !== cwd) {
      cwd = dir;
      value = "";
      at = 0;
    }

    const now = Date.now();
    if (!inFlight && now - at >= ttlMs) {
      at = now; // stamp first — avoids concurrent refreshes while the async call is in flight
      inFlight = true;
      execFile("git", args, { cwd: dir, encoding: "utf8", timeout: 3_000 }, (err, stdout) => {
        inFlight = false;
        value = err ? "" : parse(stdout as string);
      });
    }
    return value;
  }

  /** Synchronous seed (e.g. session start) — sets value + stamps TTL so get() doesn't immediately re-fire. */
  function seed(newCwd: string | undefined, newValue: string): void {
    cwd = safeCwd(newCwd);
    value = newValue;
    at = Date.now();
  }

  function reset(): void {
    value = "";
    at = 0;
    cwd = undefined;
    inFlight = false;
  }

  return { get, seed, reset };
}

function parseDirty(stdout: string): string {
  const out = stdout.trim();
  if (!out) return "";
  let staged = 0;
  let unstaged = 0;
  for (const line of out.split("\n")) {
    if (!line) continue;
    if (line[0] === "?" && line[1] === "?") continue;
    if (line[0] !== " ") staged++;
    if (line[1] !== " ") unstaged++;
  }
  const parts: string[] = [];
  if (staged) parts.push(`+${staged}`);
  if (unstaged) parts.push(`~${unstaged}`);
  return parts.join(" ");
}

const dirtyCache = cachedGit(DIRTY_TTL_MS, ["status", "--porcelain"], parseDirty);
const branchCache = cachedGit(BRANCH_TTL_MS, ["rev-parse", "--abbrev-ref", "HEAD"], (s) => s.trim());

/** Returns cached dirty state immediately; triggers async refresh when stale. */
export function getGitDirty(cwd: string | undefined): string {
  return dirtyCache.get(cwd);
}

/** Returns cached branch immediately; triggers async refresh when stale. */
export function getGitBranch(cwd: string | undefined): string {
  return branchCache.get(cwd);
}

/** Synchronous seed for the first render before any async refresh lands. */
export function seedGitBranch(cwd: string | undefined): void {
  const dir = safeCwd(cwd);
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 3_000,
      stdio: ["ignore", "pipe", "pipe"], // execFileSync inherits stderr by default — silence expected "not a git repo" noise
    }).trim();
    branchCache.seed(dir, branch);
  } catch {
    branchCache.seed(dir, "");
  }
}

export function resetGitDirtyCache(): void {
  dirtyCache.reset();
}

export function resetGitCache(): void {
  dirtyCache.reset();
  branchCache.reset();
}
