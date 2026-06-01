/**
 * safe-bash Extension
 *
 * Enforces two safety rules for pi sessions:
 *
 * 1. Delete Guard (in CWD):
 *    - Detects bash delete commands (rm, rmdir, unlink) on files within CWD
 *    - Shows a 3-choice dialog: Yes (once), No, Yes for session
 *    - "Yes for session" auto-approves all subsequent in-CWD deletes this session
 *
 * 2. Read-Only Outside CWD:
 *    - Blocks write/edit tools if path is outside CWD
 *    - Blocks bash delete commands targeting outside-CWD absolute paths
 *    - Blocks bash write patterns (>, tee, cp, mv, sed -i) to outside-CWD destinations
 *    - Allows reads anywhere
 *
 * Known limitations (v1):
 * - Symlink bypass via "ln -s /outside; edit link-in-cwd" not blocked
 * - Shell metacharacters in paths may confuse pattern matching
 * - Complex bash syntax (subshells, command substitution) handled best-effort
 * - Dynamic variables in paths treated as "in CWD" (ask to be safe)
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type {
  BashToolCallEvent,
  WriteToolCallEvent,
  EditToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { resolve, relative, isAbsolute } from "node:path";
import { notifyMacOS } from "./shared/macOS-notify.js";

// ── Session State ──────────────────────────────────────────────────────────

let deletionSessionApproved = false;

// ── Path Analysis Helpers ──────────────────────────────────────────────────

/**
 * Normalize a path: expand ~, resolve to absolute.
 */
function normalizePath(filePath: string, cwd: string): string {
  let normalized = filePath;
  // Handle bare ~ or ~/path
  if (normalized === "~") {
    normalized = homedir();
  } else if (normalized.startsWith("~/")) {
    normalized = homedir() + normalized.slice(1);
  }
  // Resolve relative paths against CWD
  if (!isAbsolute(normalized)) {
    normalized = resolve(cwd, normalized);
  }
  return normalized;
}

/**
 * Check if a path is outside the current working directory.
 */
function isOutsideCwd(filePath: string, cwd: string): boolean {
  const normalized = normalizePath(filePath, cwd);
  if (!isAbsolute(normalized)) return false; // Relative paths are in CWD

  // Use path.relative to check if normalized path escapes cwd
  const relativePath = relative(cwd, normalized);
  return relativePath.startsWith("..");
}

/**
 * Check if command contains a delete operation (rm, rmdir, unlink).
 */
function hasDeleteOp(command: string): boolean {
  return /\b(rm|rmdir|unlink)\b/.test(command);
}

/**
 * Extract paths targeted by delete operations.
 * Returns { paths: string[], hasDynamic: boolean }.
 * If command has dynamic tokens ($, backticks, etc.), hasDynamic = true.
 */
function extractDeletePaths(
  command: string,
): { paths: string[]; hasDynamic: boolean } {
  const paths: string[] = [];
  let hasDynamic = false;

  // Split on compound command boundaries (;, |, &, \n, &&, ||)
  const subCommands = command.split(/[;&]|\|\||&&|\n+/);

  for (const subCmd of subCommands) {
    // Check for delete operations in this sub-command
    const deleteMatch = subCmd.match(
      /\b(rm|rmdir|unlink)\b((?:[^;&|\n])*)/,
    );
    if (!deleteMatch) continue;

    const argsString = deleteMatch[2] || "";

    // Check for dynamic tokens: $VAR, ${VAR}, $(...), `...`, $((...))  
    if (/\$|`|\$\(|\$\{/.test(argsString)) {
      hasDynamic = true;
    }

    // Extract tokens that look like paths (not starting with -)
    const tokens = argsString
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t && !t.startsWith("-"));

    paths.push(...tokens);
  }

  return { paths, hasDynamic };
}

/**
 * Extract bash write-pattern destinations that are outside CWD.
 * Detects: output redirect (>, >>), tee, cp, mv (positional and -t flag), sed -i.
 * Checks both absolute paths (/path) and relative paths that may escape CWD (../path).
 */
function extractOutsideWritePaths(
  command: string,
  cwd: string,
): string[] {
  const outside: string[] = [];
  const addIfOutside = (path: string) => {
    if (path && isOutsideCwd(path, cwd)) {
      outside.push(path);
    }
  };
  // Helper to extract quoted/unquoted tokens
  const extractTokens = (str: string): string[] => {
    return str
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t && !t.startsWith("-"));
  };

  // --- Output redirect (>, >>) ---
  // Matches: > /path or > ../path (relative or absolute)
  const redirectRegex = />{1,2}\s*([^\s;|&]+)/g;
  for (const match of command.matchAll(redirectRegex)) {
    const path = match[1]!;
    if (!path.startsWith("-")) {
      addIfOutside(path);
    }
  }

  // --- tee: extract all arguments (both absolute and relative paths) ---
  const teeRegex = /\btee\b([^;|&\n]*)/g;
  for (const match of command.matchAll(teeRegex)) {
    const args = match[1] || "";
    const pathTokens = extractTokens(args);
    for (const path of pathTokens) {
      addIfOutside(path);
    }
  }

  // --- cp: last path argument (relative or absolute) is the destination ---
  const cpRegex = /\bcp\b([^;|&\n]+)/g;
  for (const match of command.matchAll(cpRegex)) {
    const args = match[1] || "";
    const pathTokens = extractTokens(args);
    // Last path token is likely the destination
    if (pathTokens.length > 0) {
      addIfOutside(pathTokens[pathTokens.length - 1]!);
    }
  }

  // --- mv: handle both positional (mv src dest) and -t flag form (mv -t dest src) ---
  const mvRegex = /\bmv\b([^;|&\n]*)/g;
  for (const match of command.matchAll(mvRegex)) {
    const args = match[1] || "";

    // Check for -t flag form: mv -t dest src
    const tFlagMatch = args.match(/-t\s+([^\s]+)/);
    if (tFlagMatch) {
      addIfOutside(tFlagMatch[1]!);
      continue;
    }

    // Positional form: last path is dest (relative or absolute)
    const pathTokens = extractTokens(args);
    if (pathTokens.length > 0) {
      addIfOutside(pathTokens[pathTokens.length - 1]!);
    }
  }

  // --- sed -i: check for paths when -i flag is present ---
  if (/-i/.test(command)) {
    const sedRegex = /\bsed\b([^;|&\n]*)/g;
    for (const match of command.matchAll(sedRegex)) {
      const args = match[1] || "";
      // If this sed sub-command has -i, extract paths (relative or absolute)
      if (/-i/.test(args)) {
        const pathTokens = extractTokens(args);
        for (const path of pathTokens) {
          addIfOutside(path);
        }
      }
    }
  }

  return outside;
}

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  // Reset deletion approval on session start
  pi.on("session_start", () => {
    deletionSessionApproved = false;
  });

  // Inject system prompt note
  pi.on("before_agent_start", (event, _ctx) => {
    const note =
      "\n\n[safe-bash active: deletes in CWD require confirmation; no writes/edits/deletes outside CWD]";
    return {
      systemPrompt: event.systemPrompt + note,
    };
  });

  // Main tool interception
  pi.on("tool_call", async (event, ctx) => {
    // --- Write tool: block if outside CWD ---
    if (isToolCallEventType("write", event)) {
      const writeEvent = event as WriteToolCallEvent;
      if (isOutsideCwd(writeEvent.input.path, ctx.cwd)) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `Blocked: write outside CWD - ${writeEvent.input.path}`,
            "warning",
          );
        }
        return { block: true, reason: "Write outside CWD blocked" };
      }
      return undefined;
    }

    // --- Edit tool: block if outside CWD ---
    if (isToolCallEventType("edit", event)) {
      const editEvent = event as EditToolCallEvent;
      if (isOutsideCwd(editEvent.input.path, ctx.cwd)) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `Blocked: edit outside CWD - ${editEvent.input.path}`,
            "warning",
          );
        }
        return { block: true, reason: "Edit outside CWD blocked" };
      }
      return undefined;
    }

    // --- Bash tool: delete guard + write pattern check ---
    if (isToolCallEventType("bash", event)) {
      const bashEvent = event as BashToolCallEvent;
      const command = bashEvent.input.command;

      // Check for write patterns (redirect, tee, cp, mv, sed -i) to outside CWD
      const outsideWrites = extractOutsideWritePaths(command, ctx.cwd);
      if (outsideWrites.length > 0) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `Blocked: bash write outside CWD - ${outsideWrites[0]}`,
            "warning",
          );
        }
        return { block: true, reason: "Bash write outside CWD blocked" };
      }

      // Check for delete operations
      if (hasDeleteOp(command)) {
        const { paths: rawPaths, hasDynamic } = extractDeletePaths(command);

        // Check if any extracted path is an absolute path outside CWD
        // If so, hard block (regardless of session approval)
        for (const path of rawPaths) {
          if (path.startsWith("/") && isOutsideCwd(path, ctx.cwd)) {
            if (ctx.hasUI) {
              ctx.ui.notify(
                `Blocked: delete outside CWD - ${path}`,
                "warning",
              );
            }
            return { block: true, reason: "Delete outside CWD blocked" };
          }
        }

        // At this point, no extracted absolute path was outside CWD.
        // But relative paths like ../../etc/file could still escape.
        // Double-check by normalizing all paths.
        for (const path of rawPaths) {
          if (isOutsideCwd(path, ctx.cwd)) {
            if (ctx.hasUI) {
              ctx.ui.notify(
                `Blocked: delete outside CWD — ${path}`,
                "warning",
              );
            }
            return { block: true, reason: "Delete outside CWD blocked" };
          }
        }

        // If session approved, allow
        if (deletionSessionApproved) {
          return undefined;
        }

        // If no UI, block by default (non-interactive mode)
        if (!ctx.hasUI) {
          return {
            block: true,
            reason: "Delete in CWD requires confirmation (no UI available)",
          };
        }

        // Show confirmation dialog + macOS notification
        notifyMacOS(
          "π ⚠️",
          "Delete confirmation needed",
          command.slice(0, 80),
          "Glass",
        );

        const choice = await ctx.ui.select(
          `⚠️  Delete in CWD:\n  ${command}\n\nAllow?`,
          ["Yes (once)", "No", "Yes for session"],
        );

        // undefined (timeout/abort) or "No" → block
        if (!choice || choice === "No") {
          return { block: true, reason: "Delete blocked by user" };
        }

        // "Yes for session" → set flag and allow
        if (choice === "Yes for session") {
          deletionSessionApproved = true;
          return undefined; // Allow
        }

        // "Yes (once)" → allow this one time
        return undefined;
      }

      return undefined;
    }

    // Other tools: no intervention
    return undefined;
  });
}
