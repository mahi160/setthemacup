/**
 * fzf-file.ts — use installed fzf to rank @file completions.
 *
 * fd lists project files once per session (cached, like the built-in
 * github-issue-autocomplete example caches `gh issue list`); each `@token`
 * keystroke pipes that list through `fzf --filter <token>` for fzf's fuzzy
 * ranking instead of the built-in scorer. Falls back to the built-in file
 * provider if fd/fzf are missing or return nothing.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { spawn } from "node:child_process";

const MAX_ITEMS = 20;
const FD_ARGS = ["--type", "f", "--hidden", "--exclude", ".git"];

function extractAtToken(textBeforeCursor: string): string | undefined {
  const match = textBeforeCursor.match(/(?:^|[\s(])@([^\s"]*)$/);
  return match?.[1];
}

function runFzfFilter(fileList: string, query: string, signal: AbortSignal): Promise<string[]> {
  return new Promise((resolve) => {
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn("fzf", ["--filter", query], { stdio: ["pipe", "pipe", "ignore"] });
    } catch {
      resolve([]);
      return;
    }
    let out = "";
    proc.stdout?.on("data", (d) => (out += d));
    proc.on("error", () => resolve([]));
    const onAbort = () => proc.kill("SIGTERM");
    signal.addEventListener("abort", onAbort, { once: true });
    proc.on("close", () => {
      signal.removeEventListener("abort", onAbort);
      resolve(out.split("\n").filter(Boolean));
    });
    proc.stdin?.write(fileList);
    proc.stdin?.end();
  });
}

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    // ponytail: file list cached once per session (mirrors the gh-issue
    // autocomplete example) — new files won't appear until next session.
    // Upgrade to a refresh if that gets annoying.
    let filesPromise: Promise<string[] | undefined> | undefined;
    const getFiles = (): Promise<string[] | undefined> => {
      filesPromise ||= pi
        .exec("fd", FD_ARGS, { cwd: ctx.cwd, timeout: 5_000 })
        .then((r) => (r.code === 0 ? r.stdout.split("\n").filter(Boolean) : undefined))
        .catch(() => undefined);
      return filesPromise;
    };

    ctx.ui.addAutocompleteProvider((current) => ({
      triggerCharacters: ["@"],
      async getSuggestions(lines, cursorLine, cursorCol, options) {
        const currentLine = lines[cursorLine] ?? "";
        const token = extractAtToken(currentLine.slice(0, cursorCol));
        if (token === undefined) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const files = await getFiles();
        if (!files || files.length === 0 || options.signal.aborted) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const matches = await runFzfFilter(files.join("\n"), token, options.signal);
        if (matches.length === 0) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const items: AutocompleteItem[] = matches.slice(0, MAX_ITEMS).map((path) => ({
          value: `@${path}`,
          label: path,
        }));
        return { items, prefix: `@${token}` };
      },

      applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
        return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
      },

      shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
        return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
      },
    }));
  });
}
