/**
 * footer.ts — Live session status bar.
 *
 * Layout:
 *   Above editor (widget): provider/model · cwd · git branch+dirty
 *   Bottom footer:         ↑in ↓out $cost · context% (used/total) · idle · tool counts
 *
 * All colors from theme API — adapts to any pi theme.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";

// ── Formatters ────────────────────────────────────────────────────────────────

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (n: number) => COMPACT.format(n);

function fmtIdle(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtCost(n: number): string {
  if (n <= 0) return "$0";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
}

// ── Git (dirty status only — branch comes from footerData) ────────────────────

let _gitDirtyCache = "";
let _gitDirtyAt = 0;
let _isGitRepo: boolean | undefined;

function getGitDirty(): string {
  if (_isGitRepo === false) return "";
  const now = Date.now();
  if (now - _gitDirtyAt < 10_000) return _gitDirtyCache;
  _gitDirtyAt = now;
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8", timeout: 3_000, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    _isGitRepo = true;
    if (!out) { _gitDirtyCache = ""; return ""; }
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
    _gitDirtyCache = parts.join(" ");
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("not a git repository")) _isGitRepo = false;
    _gitDirtyCache = "";
  }
  return _gitDirtyCache;
}

// ── Model display names ───────────────────────────────────────────────────────

const MODEL_NAMES: Record<string, string> = {
  "claude-opus-4-6":               "Opus 4.6",
  "claude-sonnet-4-6":             "Sonnet 4.6",
  "claude-haiku-4-5":              "Haiku 4.5",
  "gpt-5.5":                       "GPT 5.5",
  "gemini-3.1-flash-lite-preview": "Gemini 3.1 FL",
};

const PROVIDER_NAMES: Record<string, { name: string; icon: string }> = {
  anthropic:        { name: "Anthropic", icon: "󰚩" },
  "openai-codex":   { name: "OpenAI",    icon: "󰚩" },
  google:           { name: "Google",    icon: "󰊭" },
  "github-copilot": { name: "Copilot",   icon: "󰊤" },
};

// ── Line builder ──────────────────────────────────────────────────────────────

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function buildLine(left: string, right: string, width: number): string {
  if (!right) return truncateToWidth(left, width);
  const pad = Math.max(1, width - 4 - stripAnsi(left).length - stripAnsi(right).length);
  return truncateToWidth(left + " ".repeat(pad) + right, width);
}

// ── Extension ─────────────────────────────────────────────────────────────────

interface Totals { input: number; output: number; cost: number }

export default function (pi: ExtensionAPI): void {
  const toolCounts = new Map<string, number>();
  let totals: Totals = { input: 0, output: 0, cost: 0 };
  let cachedUsage: ReturnType<ExtensionContext["getContextUsage"]>;
  let lastActivityAt = 0;
  let agentRunning = false;
  let idleTimer: ReturnType<typeof setInterval> | undefined;
  let savedCtx: ExtensionContext | undefined;

  // TUI handles for requesting re-renders
  let widgetTui: { requestRender(): void } | undefined;
  let footerTui: { requestRender(): void } | undefined;

  function requestRender(): void {
    widgetTui?.requestRender();
    footerTui?.requestRender();
  }

  function installUI(ctx: ExtensionContext): void {
    // ── Widget: model / cwd / git (above editor) ────────────────────────
    ctx.ui.setWidget("status-top", (tui, theme) => {
      widgetTui = tui;
      return {
        render(width: number): string[] {
          const model = ctx.model;
          const prov = PROVIDER_NAMES[model?.provider ?? ""];
          const sep = theme.fg("borderMuted", " │ ");

          const modelPart = [
            prov ? theme.fg("accent", `${prov.icon} ${prov.name}`) : "",
            theme.fg("warning", MODEL_NAMES[model?.id?.toLowerCase() ?? ""] ?? model?.id ?? "—"),
            theme.fg("muted", `(${pi.getThinkingLevel()})`),
          ].filter(Boolean).join(" ");

          const cwdPart = theme.fg("accent", `\uF07B ${basename(ctx.cwd ?? "") || "root"}`);

          const dirty = getGitDirty();
          const branch = (ctx as any)._footerBranch ?? "";
          const gitPart = theme.fg("success", `\uE0A0 ${branch || "no-git"}`)
            + (dirty ? " " + theme.fg("error", dirty) : "");

          return [buildLine(
            modelPart + sep + cwdPart,
            gitPart,
            width,
          )];
        },
        invalidate() {},
      };
    }, { placement: "aboveEditor" });

    // ── Footer: tokens / cost / context / idle / tools (bottom) ─────────
    ctx.ui.setFooter((tui, theme, footerData) => {
      footerTui = tui;

      // Keep branch accessible for widget render
      let branch = footerData.getGitBranch() ?? "";
      (ctx as any)._footerBranch = branch;

      const dispose = footerData.onBranchChange(() => {
        branch = footerData.getGitBranch() ?? "";
        (ctx as any)._footerBranch = branch;
        tui.requestRender();
      });

      return {
        render(width: number): string[] {
          const t = totals;
          const div = theme.fg("borderMuted", " │ ");

          // Token counts
          const tokPart = [
            theme.fg("muted", `↑${fmt(t.input)}`),
            theme.fg("muted", `↓${fmt(t.output)}`),
            theme.fg("muted", fmtCost(t.cost)),
          ].join(" ");

          // Context window
          cachedUsage ??= ctx.getContextUsage();
          const pct = cachedUsage?.percent ?? null;
          let ctxPart = "";
          if (pct !== null) {
            const pctColor = pct < 60 ? "success" : pct < 80 ? "warning" : "error";
            ctxPart = theme.fg(pctColor, `${Math.round(pct)}%`) + theme.fg("dim",
              ` (${cachedUsage?.tokens != null ? fmt(cachedUsage.tokens) : "?"}/${cachedUsage ? fmt(cachedUsage.contextWindow) : "?"})`);
          }

          // Idle timer
          const idleMs = !agentRunning ? Date.now() - lastActivityAt : -1;
          let idlePart = "";
          if (idleMs >= 0) {
            const idleColor = idleMs < 180_000 ? "success"
              : idleMs < 270_000 ? "warning"
              : idleMs < 300_000 ? "error"
              : "dim";
            idlePart = theme.fg(idleColor, `idle ${fmtIdle(idleMs)}`);
          }

          // Tool counts
          const toolPart = toolCounts.size > 0
            ? [...toolCounts.entries()].map(([n, c]) => theme.fg("muted", `${n} ${c}`)).join(div)
            : "";

          const left = [tokPart, ctxPart, idlePart].filter(Boolean).join(div);
          return [buildLine(left, toolPart, width), ""];
        },
        invalidate() { tui.requestRender(); },
        dispose,
      };
    });
  }

  // ── Events ──────────────────────────────────────────────────────────────

  pi.on("session_start", (_, ctx) => {
    savedCtx = ctx;
    toolCounts.clear();
    totals = { input: 0, output: 0, cost: 0 };
    cachedUsage = undefined;
    lastActivityAt = Date.now();
    agentRunning = false;
    _isGitRepo = undefined;

    clearInterval(idleTimer);
    idleTimer = setInterval(() => { if (!agentRunning) requestRender(); }, 30_000);

    if (ctx.hasUI) installUI(ctx);
  });

  pi.on("agent_start", () => { agentRunning = true; });
  pi.on("agent_end",   () => { agentRunning = false; lastActivityAt = Date.now(); requestRender(); });

  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    const u = (event.message as AssistantMessage).usage;
    if (!u) return;
    totals.input  += u.input       ?? 0;
    totals.output += u.output      ?? 0;
    totals.cost   += u.cost?.total ?? 0;
  });

  pi.on("turn_end", () => { cachedUsage = undefined; requestRender(); });
  pi.on("model_select", () => requestRender());
  pi.on("thinking_level_select", () => requestRender());

  pi.on("tool_execution_start", (event) => {
    toolCounts.set(event.toolName, (toolCounts.get(event.toolName) ?? 0) + 1);
    requestRender();
  });

  pi.on("session_shutdown", () => {
    clearInterval(idleTimer);
    idleTimer = undefined;
    savedCtx = undefined;
    widgetTui = undefined;
    footerTui = undefined;
  });
}
