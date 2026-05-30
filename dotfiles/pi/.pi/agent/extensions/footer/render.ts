import type { Theme } from "@earendil-works/pi-coding-agent";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";
import type { FooterState } from "./state";
import { fmt, fmtCost, buildLine } from "./format";
import { getGitDirty } from "../shared/git";
import { getModelDisplayName, getProviderDisplay } from "./models";

// Tool name → nerd font icon. Falls back to generic ⚙ for unknowns.
const TOOL_ICONS: Record<string, string> = {
  bash:                               "\uF120", // 
  read:                               "\uF06E", // 
  write:                              "\uF040", // 
  edit:                               "\uF044", // 
  grep:                               "\uF002", // 
  find:                               "\uF07C", // 
  ls:                                 "\uF0CA", // 
  web_search:                         "\uF0AC", // 
  code_search:                        "\uF121", // 
  fetch_content:                      "\uF0C1", // 
  get_search_content:                 "\uF0C1", // 
  ask_user:                           "\uF128", // 
  ask_user_question:                  "\uF128", // 
  plannotator_submit_plan:            "\uF0AE", // 
  mcp__plannotator__submit_plan:      "\uF0AE",
  mcp__ask_user:                      "\uF128",
  mcp__ask_user_question:             "\uF128",
  mcp__webaccess__web_search:         "\uF0AC",
  mcp__webaccess__code_search:        "\uF121",
  mcp__webaccess__fetch_content:      "\uF0C1",
  mcp__webaccess__get_search_content: "\uF0C1",
};

function toolIcon(name: string): string {
  return (
    TOOL_ICONS[name] ??
    // strip mcp__provider__ prefix and try again
    TOOL_ICONS[name.replace(/^mcp__[^_]+__/, "")] ??
    "\u2699" // ⚙ fallback
  );
}

export function createTokenWidget(state: FooterState) {
  return (tui: any, theme: Theme) => {
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

export function createTopWidget(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  state: FooterState,
) {
  return (tui: any, theme: Theme) => {
    state.widgetTui = tui;
    return {
      render(width: number): string[] {
        const model = ctx.model;
        const prov = getProviderDisplay(model?.provider);
        const sep = theme.fg("borderMuted", " │ ");

        const modelPart = [
          prov ? theme.fg("accent", `${prov.icon} ${prov.name}`) : "",
          theme.fg("warning", getModelDisplayName(model?.id)),
          theme.fg("muted", `(${pi.getThinkingLevel()})`),
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

export function createFooter(ctx: ExtensionContext, state: FooterState) {
  return (tui: any, theme: Theme, footerData: any) => {
    state.footerTui = tui;

    state.footerDispose?.();
    state.footerDispose = undefined;

    state.branch = footerData.getGitBranch() ?? "";
    const dispose = footerData.onBranchChange(() => {
      state.branch = footerData.getGitBranch() ?? "";
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

        // Array.from does one-pass iteration, avoids spread + map allocations
        const toolPart =
          state.toolCounts.size > 0
            ? Array.from(state.toolCounts, ([n, c]) =>
                theme.fg("muted", `${toolIcon(n)} ${c}`),
              ).join(div)
            : "";

        const isPlanning = state.plannotatorPhase === "planning";
        const label = isPlanning ? " PLAN " : " BUILD ";
        const bg = isPlanning ? "toolSuccessBg" : "toolPendingBg";
        const fgColor = isPlanning ? "success" : "accent";
        const modePart = theme.bg(bg, theme.fg(fgColor, label));

        const costPart = theme.fg("dim", fmtCost(state.sessionCost));

        const reqPart = theme.fg("dim", ` ${state.sessionRequests}`);

        const left = [modePart, costPart, reqPart, ctxPart]
          .filter(Boolean)
          .join(div);
        return [buildLine(left, toolPart, width), ""];
      },
      invalidate() {
        tui.requestRender();
      },
      dispose,
    };
  };
}
