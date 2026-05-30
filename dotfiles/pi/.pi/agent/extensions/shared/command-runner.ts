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
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
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

/**
 * Runs a command in a clean session with live widget feedback.
 * Handles widget setup, spinner animation, and execution.
 * Returns exit code + full output text.
 * No output display — caller decides (notify vs file, etc).
 */
export async function runCommand(options: {
  agent: SubagentConfig;
  model: Model;
  prompt: string;
  ctx: ExtensionCommandContext;
}): Promise<CommandResult> {
  const { agent, model, prompt, ctx } = options;

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
  const widgetKey = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Setup widget
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
            inner.push(
              theme.fg("warning", `  ↻ retry ${widgetState.retryAttempt}...`),
            );
          } else if (widgetState.currentTool) {
            const toolInfo = widgetState.currentTool.slice(0, iw - 6);
            inner.push(
              theme.fg("warning", `  ▸`) + theme.fg("dim", ` ${toolInfo}`),
            );
          } else {
            inner.push(theme.fg("dim", `  ⏳ processing...`));
          }

          if (widgetState.toolCount > 0) {
            inner.push(
              theme.fg(
                "muted",
                `  ${widgetState.toolCount} tool${widgetState.toolCount !== 1 ? "s" : ""}`,
              ),
            );
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
      widgetState.spinnerFrame =
        (widgetState.spinnerFrame + 1) % SPINNER_FRAMES.length;
      widgetState.elapsedMs += 100;
      widgetTui?.requestRender();
    }, 100);

    ({ exitCode, fullText } = await spawnCleanSession(
      `${model.provider}/${model.id}`,
      agent.thinking ?? "low",
      prompt,
      new AbortSignal(),
      widgetState,
      () => widgetTui?.requestRender(),
    ));
  } finally {
    clearInterval(spinnerTimer);
    ctx.ui.setWidget(widgetKey, undefined);
  }

  return { exitCode, fullText };
}
