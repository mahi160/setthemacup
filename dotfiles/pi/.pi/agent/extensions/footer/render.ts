import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";
import type { FooterState } from "./state";
import { fmt, fmtCost, fmtIdle, buildLine } from "./format";
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
        const t = state.totals;
        const div = theme.fg("borderMuted", " │ ");

        // All muted tokens merged into one theme.fg call — fewer allocations
        const tokPart = theme.fg(
          "muted",
          `↑${fmt(t.input)} ↓${fmt(t.output)} ${fmtCost(t.cost)}`,
        );

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

        const idleMs = !state.agentRunning
          ? Date.now() - state.lastActivityAt
          : -1;
        let idlePart = "";
        if (idleMs >= 0) {
          const idleColor =
            idleMs < 180_000
              ? "success"
              : idleMs < 270_000
                ? "warning"
                : idleMs < 300_000
                  ? "error"
                  : "dim";
          idlePart = theme.fg(idleColor, `idle ${fmtIdle(idleMs)}`);
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

        const statsLeft = [tokPart, ctxPart, idlePart]
          .filter(Boolean)
          .join(div);
        const left = modePart + div + statsLeft;
        return [buildLine(left, toolPart, width), ""];
      },
      invalidate() {
        tui.requestRender();
      },
      dispose,
    };
  };
}
