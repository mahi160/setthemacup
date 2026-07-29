import type { Theme } from "@earendil-works/pi-coding-agent";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";
import type { FooterState } from "./state";
import { fmt, fmtCost, buildLine } from "./format";
import { getGitDirty } from "../shared/git";
import { getProviderIcon } from "./models";

// Tool name → nerd font icon. Falls back to generic ⚙ for unknowns.
const TOOL_ICONS: Record<string, string> = {
  bash: "\uF120",
  read: "\uF06E",
  write: "\uF040",
  edit: "\uF044",
  grep: "\uF002",
  find: "\uF07C",
  ls: "\uF0CA",
  web_search: "\uF0AC",
  code_search: "\uF121",
  fetch_content: "\uF0C1",
  get_search_content: "\uF0C1",
  ask_user: "\uF128",
  ask_user_question: "\uF128",
  plannotator_submit_plan: "\uF0AE",
};

const MCP_PREFIX = /^mcp__[^_]+__/;

function toolIcon(name: string): string {
  return (
    TOOL_ICONS[name] ?? TOOL_ICONS[name.replace(MCP_PREFIX, "")] ?? "\u2699"
  );
}

interface TuiHandle {
  requestRender(): void;
}
interface FooterData {
  getGitBranch(): string | null;
  onBranchChange(cb: () => void): () => void;
}

/**
 * Last-turn token/cost stats. Rendered aboveEditor so it sits directly
 * under the latest message — not in the footer, which sits below the
 * editor.
 */
export function createTokenWidget(state: FooterState) {
  return (tui: TuiHandle, theme: Theme) => {
    state.widgetTokenTui = tui;
    return {
      render(_width: number): string[] {
        if (!state.sessionHasData) return [];
        const div = theme.fg("borderMuted", " │ ");
        const parts = [
          theme.fg("dim", `↑ ${fmt(state.lastTurnInput)}`),
          theme.fg("dim", `↓ ${fmt(state.lastTurnOutput)}`),
          ...(state.lastTurnCacheRead > 0
            ? [theme.fg("dim", `∅ ${fmt(state.lastTurnCacheRead)}`)]
            : []),
          theme.fg("dim", fmtCost(state.lastTurnCost)),
        ];
        return [" " + parts.join(div), " "];
      },
      invalidate() {},
    };
  };
}

/**
 * Top status line: provider/model/thinking-level ⟷ cwd + git branch/dirty.
 * Cached per-width; render() is cheap to call often since dirty/branch reads
 * are themselves cached in shared/git and footerData.
 */
export function createTopWidget(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  state: FooterState,
) {
  return (tui: TuiHandle, theme: Theme) => {
    state.widgetTui = tui;
    return {
      render(width: number): string[] {
        const model = ctx.model;
        const icon = getProviderIcon(model?.provider);
        const providerName = model?.provider
          ? ctx.modelRegistry.getProviderDisplayName(model.provider)
          : undefined;
        const sep = theme.fg("borderMuted", " │ ");

        const modelPart = [
          providerName ? theme.fg("accent", `${icon} ${providerName}`) : "",
          theme.fg("warning", model?.name ?? "—"),
          ctx.thinkingLevel ? theme.fg("muted", `(${ctx.thinkingLevel})`) : "",
        ]
          .filter(Boolean)
          .join(" ");

        const cwdPart = theme.fg(
          "accent",
          `\uF07B ${basename(ctx.cwd ?? "") || "root"}`,
        );

        const dirty = getGitDirty(ctx.cwd ?? "");
        const gitPart =
          theme.fg("success", `\uE0A0 ${state.branch || "no-git"}`) +
          (dirty ? " " + theme.fg("error", dirty) : "");

        return [buildLine(modelPart + sep + cwdPart, gitPart, width)];
      },
      invalidate() {},
    };
  };
}

/**
 * Footer: mode badge + session totals + context usage ⟷ tool call counts,
 * plus a second row with last-turn token deltas.
 */
export function createFooter(ctx: ExtensionContext, state: FooterState) {
  return (tui: TuiHandle, theme: Theme, footerData: FooterData) => {
    state.footerTui = tui;

    state.footerDispose?.();
    state.branch = footerData.getGitBranch() ?? "";
    const dispose = footerData.onBranchChange(() => {
      state.branch = footerData.getGitBranch() ?? "";
      state.widgetTui?.requestRender();
      tui.requestRender();
    });
    state.footerDispose = dispose;

    return {
      render(width: number): string[] {
        const div = theme.fg("borderMuted", " │ ");

        state.cachedUsage ??= ctx.getContextUsage();
        const pct = state.cachedUsage?.percent ?? null;
        let ctxPart = "";
        if (pct !== null) {
          const pctColor =
            pct < 60 ? "success" : pct < 80 ? "warning" : "error";
          ctxPart =
            theme.fg(pctColor, `${Math.round(pct)}%`) +
            theme.fg(
              "dim",
              ` (${state.cachedUsage?.tokens != null ? fmt(state.cachedUsage.tokens) : "?"}/${state.cachedUsage ? fmt(state.cachedUsage.contextWindow) : "?"})`,
            );
        }

        const toolPart =
          state.toolCounts.size > 0
            ? Array.from(state.toolCounts, ([n, c]) =>
                theme.fg("muted", `${toolIcon(n)} ${c}`),
              ).join(div)
            : "";

        const costPart = theme.fg("dim", fmtCost(state.sessionCost));
        const reqPart = theme.fg("dim", ` ${state.sessionRequests}`);

        const left = [costPart, reqPart, ctxPart].filter(Boolean).join(div);
        return [buildLine(left, toolPart, width), ""];
      },
      invalidate() {
        tui.requestRender();
      },
      dispose,
    };
  };
}
