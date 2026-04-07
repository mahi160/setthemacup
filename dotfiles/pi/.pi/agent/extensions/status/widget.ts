import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { MODELS, PROVIDERS } from "./constants.js";
import { getGitBranch, GitDirtyTracker } from "./git.js";
import type { Provider, RenderOutput, WidgetData } from "./types.js";

type PiModel = NonNullable<ExtensionContext["model"]>;

export class StatusWidget {
  private pi: ExtensionAPI;
  private ctx: ExtensionContext;
  model?: PiModel;

  private gitBranch: string;
  private gitDirty = new GitDirtyTracker();
  private lastRenderKey = "";

  constructor(pi: ExtensionAPI, ctx: ExtensionContext, model?: PiModel) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
    this.gitBranch = getGitBranch();
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
      tokens: `${Math.round(((usage?.tokens ?? 0) as number) / 1000)}k`,
      percent: `${Math.round((usage?.percent ?? 0) as number)}%`,
      project: this.ctx.cwd?.split("/").pop() ?? "root",
      git: this.gitBranch,
      dirty: this.gitDirty.get(),
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
    } = data;

    const top = modelName
      ? `${provider.color}${provider.icon} ${provider.name}\x1b[0m | ${modelName} (${thinking}) | ${tokens} (${percent})`
      : "";

    const bottom = `${project} | ${git}${dirty}`;

    return {
      top: top ? [top] : [],
      bottom: [bottom],
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
