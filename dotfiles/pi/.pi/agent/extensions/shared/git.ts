import { execFile, execFileSync } from "node:child_process";

const DIRTY_TTL_MS = 10_000;
const BRANCH_TTL_MS = 5_000;

let _dirtyCache = "";
let _dirtyAt = 0;
let _isGitRepo: boolean | undefined;
let _dirtyCwd: string | undefined;

let _branch = "";
let _branchAt = 0;
let _branchCwd: string | undefined;
let _branchInFlight = false;

function safeCwd(cwd: string | undefined): string {
  return cwd || process.cwd();
}

/** Returns cached dirty state immediately; triggers async refresh when stale. */
export function getGitDirty(cwd: string | undefined): string {
  const dir = safeCwd(cwd);
  if (dir !== _dirtyCwd) {
    _dirtyCwd = dir;
    resetGitDirtyCache();
  }
  if (_isGitRepo === false) return "";

  const now = Date.now();
  if (now - _dirtyAt >= DIRTY_TTL_MS) {
    _dirtyAt = now; // stamp first — prevents concurrent refreshes during async call

    execFile(
      "git",
      ["status", "--porcelain"],
      { cwd: dir, encoding: "utf8", timeout: 3_000 },
      (err, stdout) => {
        if (err) {
          if (String(err.message).includes("not a git repository")) _isGitRepo = false;
          _dirtyCache = "";
          return;
        }
        _isGitRepo = true;
        const out = (stdout as string).trim();
        if (!out) { _dirtyCache = ""; return; }

        let staged = 0, unstaged = 0;
        for (const line of out.split("\n")) {
          if (!line) continue;
          if (line[0] === "?" && line[1] === "?") continue;
          if (line[0] !== " ") staged++;
          if (line[1] !== " ") unstaged++;
        }
        const parts: string[] = [];
        if (staged) parts.push(`+${staged}`);
        if (unstaged) parts.push(`~${unstaged}`);
        _dirtyCache = parts.join(" ");
      },
    );
  }

  return _dirtyCache;
}

export function seedGitBranch(cwd: string | undefined): void {
  const dir = safeCwd(cwd);
  try {
    _branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 3_000,
    }).trim();
  } catch {
    _branch = "";
  }
  _branchCwd = dir;
  _branchAt = Date.now();
}

/** Returns cached branch immediately; triggers async refresh when stale. */
export function getGitBranch(cwd: string | undefined): string {
  const dir = safeCwd(cwd);
  if (dir !== _branchCwd) {
    _branchCwd = dir;
    _branch = "";
    _branchAt = 0;
  }

  const now = Date.now();
  if (!_branchInFlight && now - _branchAt >= BRANCH_TTL_MS) {
    _branchAt = now;
    _branchInFlight = true;
    execFile(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: dir, encoding: "utf8", timeout: 3_000 },
      (err, stdout) => {
        _branchInFlight = false;
        _branch = err ? "" : (stdout as string).trim();
      },
    );
  }

  return _branch;
}

export function resetGitDirtyCache(): void {
  _dirtyCache = "";
  _dirtyAt = 0;
  _isGitRepo = undefined;
}

export function resetGitCache(): void {
  resetGitDirtyCache();
  _branch = "";
  _branchAt = 0;
  _branchCwd = undefined;
  _branchInFlight = false;
}
