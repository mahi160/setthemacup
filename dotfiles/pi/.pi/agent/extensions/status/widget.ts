import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { MODELS, PROVIDERS } from "./constants.js";
import { getGitBranch, GitDirtyTracker } from "./git.js";
import { buildBottomLine, formatTool } from "./tools.js";
import type { Provider, RenderOutput, WidgetData } from "./types.js";

type PiModel = NonNullable<ExtensionContext["model"]>;

export class StatusWidget {
  private pi: ExtensionAPI;
  private ctx: ExtensionContext;
  model?: PiModel;

  private gitBranch: string;
  private gitDirty = new GitDirtyTracker();
  private lastRenderKey = "";
  private toolCounts = new Map<string, number>();

  constructor(pi: ExtensionAPI, ctx: ExtensionContext, model?: PiModel) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
    this.gitBranch = getGitBranch();
  }

  startTool(name: string): void {
    this.toolCounts.set(name, (this.toolCounts.get(name) ?? 0) + 1);
    this.update();
  }

  private compute(): WidgetData {
    const id = this.model?.id?.toLowerCase() ?? "";
    const provider: Provider =
      PROVIDERS[this.model?.provider as keyof typeof PROVIDERS] ??
      ({ name: "", icon: "", color: "" } as Provider);

    const usage = this.ctx.getContextUsage();

    return {
      provider,
      modelName: MODELS[id] ?? id,
      thinking: this.pi.getThinkingLevel(),
      tokens: `${Math.round((usage?.tokens ?? 0) / 1000)}k`,
      percent: `${Math.round(usage?.percent ?? 0)}%`,
      project: this.ctx.cwd?.split("/").pop() ?? "root",
      git: this.gitBranch,
      dirty: this.gitDirty.get(),
      tool: [...this.toolCounts.entries()]
        .map(([name, count]) => formatTool(name, count))
        .join(""),
    };
  }

  private render(data: WidgetData): RenderOutput {
    const {
      provider,
      modelName,
      thinking,
      tokens,
      percent,
      project,
      git,
      dirty,
      tool,
    } = data;

    // \uF005 = nf-fa-star  \uF2DB = nf-fa-microchip  \uF0E7 = nf-fa-bolt
    // \uF07B = nf-fa-folder  \uE0A0 = nf-pl-branch

    // Top: provider | model | thinking | tokens | context %
    const top = modelName
      ? `${provider.color}${provider.icon} ${provider.name}\x1b[0m  \x1b[1;38;5;117m\uF005 ${modelName}\x1b[0m  \x1b[38;5;246m(${thinking})\x1b[0m  \x1b[38;5;114m\uF2DB ${tokens}\x1b[0m  \x1b[38;5;216m\uF0E7 ${percent}\x1b[0m`
      : "";

    // Bottom: folder + git branch
    const projectSection = `\x1b[38;5;179m\uF07B ${project}\x1b[0m`;
    const gitSection = `\x1b[38;5;208m\uE0A0 ${git}${dirty}\x1b[0m`;
    const bottomLeft = `${projectSection}  ${gitSection}`;
    const bottomLine = buildBottomLine(bottomLeft, tool);

    return {
      top: top ? [top] : [],
      bottom: [bottomLine],
    };
  }

  update(): void {
    const data = this.compute();
    const key = JSON.stringify(data);
    if (key === this.lastRenderKey) return;
    this.lastRenderKey = key;

    const { top, bottom } = this.render(data);
    this.ctx.ui.setWidget("status-top", top, { placement: "aboveEditor" });
    this.ctx.ui.setWidget("status-bottom", bottom, {
      placement: "belowEditor",
    });
  }
}
