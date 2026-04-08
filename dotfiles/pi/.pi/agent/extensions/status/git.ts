import { execSync } from "node:child_process";

const GIT_OPTS = { encoding: "utf8" as const };

/** Cached git branch tracker — re-checks every N ms. */
export class GitBranchTracker {
  private cached = "no-git";
  private lastCheck = 0;
  private readonly ttlMs = 3000;

  get(): string {
    const now = Date.now();
    if (now - this.lastCheck < this.ttlMs) return this.cached;
    this.lastCheck = now;
    try {
      this.cached = execSync("git rev-parse --abbrev-ref HEAD", GIT_OPTS).trim();
    } catch {
      this.cached = "no-git";
    }
    return this.cached;
  }
}

/** Cached git dirty tracker — re-checks every N ms. */
export class GitDirtyTracker {
  private cached = "";
  private lastCheck = 0;
  private readonly ttlMs = 1500;

  get(): string {
    const now = Date.now();
    if (now - this.lastCheck < this.ttlMs) return this.cached;
    this.lastCheck = now;
    try {
      this.cached = execSync("git status --porcelain", GIT_OPTS).trim() ? "*" : "";
    } catch {
      this.cached = "";
    }
    return this.cached;
  }
}
