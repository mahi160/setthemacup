import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { MODELS, PROVIDERS, EMPTY_PROVIDER } from "./constants.js";
import { GitBranchTracker, GitDirtyTracker } from "./git.js";
import { buildLine, formatTool } from "./tools.js";
import type { WidgetData } from "./types.js";

type PiModel = NonNullable<ExtensionContext["model"]>;

/* ─── ANSI shorthand ──────────────────────────────────────────────────────── */

const R = "\x1b[0m";
const ansi = (code: string, text: string) => `${code}${text}${R}`;
const bold = (code: string, text: string) => `\x1b[1;${code}${text}${R}`;

/* ─── widget ──────────────────────────────────────────────────────────────── */

export class StatusWidget {
  private pi: ExtensionAPI;
  private ctx: ExtensionContext;
  model?: PiModel;

  // #7: branch now re-checks on each update via cached tracker (3s TTL)
  private branch = new GitBranchTracker();
  private dirty = new GitDirtyTracker();
  private toolCounts = new Map<string, number>();
  private renderKey = "";

  constructor(pi: ExtensionAPI, ctx: ExtensionContext, model?: PiModel) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
  }

  startTool(name: string): void {
    this.toolCounts.set(name, (this.toolCounts.get(name) ?? 0) + 1);
    this.update();
  }

  update(): void {
    const data = this.compute();
    const key = JSON.stringify(data);
    if (key === this.renderKey) return;
    this.renderKey = key;

    const { top, bottom } = this.render(data);
    this.ctx.ui.setWidget("status-top", top, { placement: "aboveEditor" });
    this.ctx.ui.setWidget("status-bottom", bottom, { placement: "belowEditor" });
  }

  private compute(): WidgetData {
    const id = this.model?.id?.toLowerCase() ?? "";
    const provider = PROVIDERS[this.model?.provider as string] ?? EMPTY_PROVIDER;
    const usage = this.ctx.getContextUsage();

    return {
      provider,
      model: MODELS[id] ?? id,
      thinking: this.pi.getThinkingLevel(),
      tokens: `${Math.round((usage?.tokens ?? 0) / 1000)}k`,
      percent: `${Math.round(usage?.percent ?? 0)}%`,
      project: this.ctx.cwd?.split("/").pop() ?? "root",
      branch: this.branch.get(),
      dirty: this.dirty.get(),
      tools: [...this.toolCounts.entries()].map(([n, c]) => formatTool(n, c)).join(""),
    };
  }

  private render(d: WidgetData): { top: string[]; bottom: string[] } {
    if (!d.model) return { top: [], bottom: [buildLine("", d.tools)] };

    const topLeft = [
      ansi(d.provider.color, `${d.provider.icon} ${d.provider.name}`),
      bold("38;5;117m", `\uF005 ${d.model}`),
      ansi("\x1b[38;5;246m", `(${d.thinking})`),
      ansi("\x1b[38;5;114m", `\uF2DB ${d.tokens}`),
      ansi("\x1b[38;5;216m", `\uF0E7 ${d.percent}`),
    ].join("  ");

    const topRight = [
      ansi("\x1b[38;5;179m", `\uF07B ${d.project}`),
      ansi("\x1b[38;5;208m", `\uE0A0 ${d.branch}${d.dirty}`),
    ].join("  ");

    return {
      top: [buildLine(topLeft, topRight)],
      bottom: [buildLine("", d.tools)],
    };
  }
}
