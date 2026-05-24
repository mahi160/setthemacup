/**
 * git.ts — Non-blocking git dirty-state tracker for the footer widget.
 *
 * getGitDirty() is called from TUI render callbacks (synchronous context).
 * It always returns the cached value immediately and kicks off an async
 * background refresh when the cache is stale (>10s). This prevents
 * execFileSync from freezing the render thread.
 *
 * Cache is reset on cwd change (session switch) via resetGitCache().
 *
 * To change the poll interval, adjust CACHE_TTL_MS.
 * To change what counts as dirty, edit the loop below the execFile call.
 */

import { execFile } from "node:child_process";

const CACHE_TTL_MS = 10_000;

let _cache = "";
let _cachedAt = 0;
let _isGitRepo: boolean | undefined;
let _lastCwd: string | undefined;

/** Returns cached dirty state immediately; triggers async refresh when stale. */
export function getGitDirty(cwd: string): string {
  if (cwd !== _lastCwd) {
    _lastCwd = cwd;
    resetGitCache();
  }
  if (_isGitRepo === false) return "";

  const now = Date.now();
  if (now - _cachedAt >= CACHE_TTL_MS) {
    _cachedAt = now; // stamp first — prevents concurrent refreshes during the async call

    execFile(
      "git",
      ["status", "--porcelain"],
      { cwd, encoding: "utf8", timeout: 3_000 },
      (err, stdout) => {
        if (err) {
          if (String(err.message).includes("not a git repository")) _isGitRepo = false;
          _cache = "";
          return;
        }
        _isGitRepo = true;
        const out = (stdout as string).trim();
        if (!out) { _cache = ""; return; }

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
        _cache = parts.join(" ");
      },
    );
  }

  return _cache;
}

export function resetGitCache(): void {
  _cache = "";
  _cachedAt = 0;
  _isGitRepo = undefined;
}
