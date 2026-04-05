import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { basename } from "node:path";

type Model = {
  id: string;
  provider: "anthropic" | "github-copilot";
};

type Meta = {
  [key: string]: {
    name: string;
    icon: string;
    models: { [key: string]: string };
    color: string;
  };
};

type Ctx = {
  cwd: string;
  model?: Model;
  ui: {
    setWidget: (
      id: string,
      content: string[],
      opts?: { position?: string },
    ) => void;
    setFooter: (fn: () => { render(): string[]; invalidate(): void }) => void;
  };
  getContextUsage: () => { tokens: number; percent: number } | undefined;
  sessionManager: {
    getEntries: () => {
      type: string;
      customType?: string;
      data?: { model?: Model };
    }[];
  };
};

const META: Meta = {
  anthropic: {
    name: "Anthropic",
    icon: "󰚩",
    color: "\x1b[38;5;208m",
    models: {
      "claude-sonnet-4-6": "Sonnet 4.6",
      "claude-opus-4-6": "Opus 4.6",
      "claude-haiku-4-5": "Haiku 4.5",
    },
  },
  "github-copilot": {
    name: "Copilot",
    icon: "",
    color: "\x1b[94m",
    models: {
      "gpt-4.1": "GPT 4.1",
      "gpt-5-mini": "GPT 5 mini",
    },
  },
} as const;

const sh = (cmd: string) => {
  try {
    return execSync(cmd, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
};

const git = () => {
  const branch = sh("git rev-parse --abbrev-ref HEAD") || "none";
  const dirty = sh("git status --porcelain") ? "*" : "";
  return `${branch}${dirty}`;
};

const format = (m: Model, ctx: Ctx, thinking: string, tool?: string | null) => {
  const meta = META[m.provider];
  const id = m.id.toLowerCase();

  const name = meta.models[id] || id;
  const usage = ctx.getContextUsage();

  const tokens = usage ? `${Math.round(usage.tokens / 1000)}k` : "0k";
  const pct = usage ? `${Math.round(usage.percent)}%` : "0%";

  const toolStr = tool ? ` | \x1b[33m󱆃 ${tool}...\x1b[0m` : "";

  return `${meta.color}${meta.icon} ${meta.name}\x1b[0m | ${name} | ${thinking} |  ${tokens} (${pct})${toolStr} |  ${git()} | ${basename(ctx.cwd)}`;
};

export default function (pi: ExtensionAPI) {
  let model: Model | undefined;
  let tool: string | null = null;

  const render = (ctx: Ctx) => {
    const m = model ?? ctx.model;
    if (!m) return;

    const thinking = (pi as any).getThinkingLevel?.() ?? "normal";

    ctx.ui.setWidget("pistatus", [format(m, ctx, thinking, tool)], {
      position: "above",
    });

    ctx.ui.setFooter(() => ({
      render: () => [],
      invalidate() {},
    }));
  };

  const set = (m: Model | undefined, ctx: Ctx, persist = false) => {
    if (!m) return;
    model = m;
    if (persist) pi.appendEntry("model-info", { model });
    render(ctx);
  };

  const restore = (ctx: Ctx) => {
    if (ctx.model) return set(ctx.model, ctx);

    const entry = ctx.sessionManager
      .getEntries()
      .findLast((e) => e.type === "custom" && e.customType === "model-info");

    set(entry?.data?.model, ctx);
  };

  pi.on("session_start", (_, ctx) => restore(ctx));
  pi.on("model_select", (e, ctx) => set(e.model, ctx, true));
  pi.on("tool_execution_start", (e, ctx) => {
    tool = e.toolName;
    render(ctx);
  });
  pi.on("tool_execution_end", (_, ctx) => {
    tool = null;
    render(ctx);
  });
  ["message_end", "agent_start", "input"].forEach((event) =>
    pi.on(event as any, (_, ctx) => {
      if (event === "input" && !model) set(ctx.model, ctx);
      render(ctx);
    }),
  );
}
