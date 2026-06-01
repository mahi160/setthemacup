/**
 * shared/command-runner.ts — Abstracts widget setup + spinner + command execution.
 *
 * High-level helper that orchestrates:
 * - Widget setup (spinner, tool tracking, output streaming)
 * - Timer for spinner animation
 * - spawnCleanSession execution
 * - Result return
 *
 * Caller decides output format (notify, file, etc).
 */

import {
  truncateToWidth,
  type Theme,
} from "@earendil-works/pi-tui";
import type { ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  spawnCleanSession,
  bordered,
  SPINNER_FRAMES,
  type WidgetState,
  type SubagentConfig,
  type Model,
} from "./spawn-subagent";

export interface CommandResult {
  exitCode: number | null;
  fullText: string;
}

// Minimal context shape needed for widget display
export interface WidgetContext {
  ui: {
    setWidget(
      key: string,
      renderer:
        | ((tui: { requestRender(): void }, theme: import("@earendil-works/pi-tui").Theme) => { render(w: number): string[]; invalidate(): void })
        | undefined,
      opts?: { placement?: string },
    ): void;
  };
}

/**
 * Core: runs a subagent with live spinner widget.
 * Accepts any context that has ui.setWidget — works for both
 * ExtensionCommandContext (fast commands) and ExtensionContext (tools).
 */
export async function runWithWidget(options: {
  agent: SubagentConfig;
  model: Model;
  prompt: string;
  signal: AbortSignal;
  ctx: WidgetContext;
  tools?: string[];
}): Promise<CommandResult> {
  const { agent, model, prompt, signal, ctx, tools } = options;

  const widgetState: WidgetState & {
    model: string;
    agent: string;
    icon: string;
  } = {
    spinnerFrame: 0,
    elapsedMs: 0,
    currentTool: "",
    toolCount: 0,
    recentText: [],
    retrying: false,
    retryAttempt: 0,
    model: model.id,
    agent: agent.label,
    icon: agent.icon || "󰚩",
  };

  let widgetTui: { requestRender(): void } | undefined;
  const widgetKey = `subagent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  ctx.ui.setWidget(
    widgetKey,
    (tui, theme) => {
      widgetTui = tui;
      return {
        render(width: number): string[] {
          const iw = Math.max(0, width - 4);
          const spin = theme.fg(
            "warning",
            SPINNER_FRAMES[widgetState.spinnerFrame % SPINNER_FRAMES.length]!,
          );
          const elapsed = theme.fg(
            "dim",
            ` ${(widgetState.elapsedMs / 1000).toFixed(1)}s`,
          );
          const header =
            spin +
            theme.fg("success", ` ${widgetState.icon} ${widgetState.agent}`) +
            theme.fg("muted", ` · ${widgetState.model}`) +
            elapsed;

          const inner: string[] = [header];

          if (widgetState.retrying) {
            inner.push(theme.fg("warning", `  ↻ retry ${widgetState.retryAttempt}...`));
          } else if (widgetState.currentTool) {
            inner.push(theme.fg("warning", `  ▸`) + theme.fg("dim", ` ${widgetState.currentTool.slice(0, iw - 6)}`));
          } else {
            inner.push(theme.fg("dim", `  ⏳ processing...`));
          }

          if (widgetState.toolCount > 0) {
            inner.push(theme.fg("muted", `  ${widgetState.toolCount} tool${widgetState.toolCount !== 1 ? "s" : ""}`));
          }

          if (widgetState.recentText.length > 0) {
            inner.push(theme.fg("dim", ""));
            for (const line of widgetState.recentText) {
              inner.push(theme.fg("dim", `  ${line.slice(0, iw - 4)}`));
            }
          }

          while (inner.length < 6) inner.push("");
          return bordered(inner.slice(0, 12), width, theme);
        },
        invalidate() {},
      };
    },
    { placement: "belowEditor" },
  );

  let spinnerTimer: ReturnType<typeof setInterval> | undefined;
  let exitCode: number | null = null;
  let fullText = "";

  try {
    spinnerTimer = setInterval(() => {
      widgetState.spinnerFrame = (widgetState.spinnerFrame + 1) % SPINNER_FRAMES.length;
      widgetState.elapsedMs += 100;
      widgetTui?.requestRender();
    }, 100);

    ({ exitCode, fullText } = await spawnCleanSession(
      `${model.provider}/${model.id}`,
      agent.thinking ?? "low",
      prompt,
      signal,
      widgetState,
      () => widgetTui?.requestRender(),
      tools,
    ));
  } finally {
    clearInterval(spinnerTimer);
    ctx.ui.setWidget(widgetKey, undefined);
  }

  return { exitCode, fullText };
}

/**
 * Convenience wrapper for fast commands (ExtensionCommandContext).
 * Uses its own AbortController — commands aren't cancellable mid-flight.
 */
export async function runCommand(options: {
  agent: SubagentConfig;
  model: Model;
  prompt: string;
  ctx: ExtensionCommandContext;
  tools?: string[];
}): Promise<CommandResult> {
  const abort = new AbortController();
  return runWithWidget({ ...options, signal: abort.signal });
}
