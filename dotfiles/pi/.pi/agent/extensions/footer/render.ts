import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";
import type { FooterState } from "./state";
import { fmt, fmtCost, buildLine } from "./format";
import { getGitDirty } from "./git";
import { getModelDisplayName, getProviderDisplay } from "./models";

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
                theme.fg("muted", `${n} ${c}`),
              ).join(div)
            : "";

        const isPlanning = state.plannotatorPhase === "planning";
        const label = isPlanning ? " PLAN " : " BUILD ";
        const bg = isPlanning ? "toolSuccessBg" : "toolPendingBg";
        const modePart = theme.bg(bg, theme.fg("text", label));

        const costPart = state.sessionHasData ? theme.fg("dim", fmtCost(state.sessionCost)) : "";
        const reqPart = state.sessionRequests > 0
          ? theme.fg("dim", `\uD83D\uDCE8 ${state.sessionRequests}`)
          : "";

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
