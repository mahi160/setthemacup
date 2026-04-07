import { execSync } from "node:child_process";

export function getGitBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    return "no-git";
  }
}

export class GitDirtyTracker {
  private last = 0;
  private dirty = "";

  get(): string {
    const now = Date.now();
    if (now - this.last < 1500) return this.dirty;

    this.last = now;
    try {
      const out = execSync("git status --porcelain", {
        encoding: "utf8",
      }).trim();
      this.dirty = out ? "*" : "";
    } catch {
      this.dirty = "";
    }

    return this.dirty;
  }
}
