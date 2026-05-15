import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { execSync } from "node:child_process";
import { basename } from "node:path";

// ── Gruvbox Material palette (24-bit) ───────────────────────────────────────
const R = "\x1b[0m";
const c = (code: string, text: string) => `${code}${text}${R}`;

// fg helpers
const GRV = {
  yellow: "\x1b[38;2;216;166;87m",   // #d8a657
  orange: "\x1b[38;2;231;138;78m",    // #e78a4e
  red:    "\x1b[38;2;234;105;98m",    // #ea6962
  green:  "\x1b[38;2;169;182;101m",   // #a9b665
  aqua:   "\x1b[38;2;137;180;130m",   // #89b482
  blue:   "\x1b[38;2;125;174;163m",   // #7daea3
  purple: "\x1b[38;2;211;134;155m",   // #d3869b
  gray:   "\x1b[38;2;146;131;116m",   // #928374
  fg:     "\x1b[38;2;212;190;152m",   // #d4be98
  bg4:    "\x1b[38;2;124;111;100m",   // #7c6f64
  bg3:    "\x1b[38;2;102;92;84m",     // #665c54
} as const;

const FMT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const fmt = (n: number) => FMT.format(n);

function fmtIdle(ms: number): string {
  const s = Math.floor(ms / 1000),
    m = Math.floor(s / 60),
    h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function buildLine(left: string, right: string): string {
  if (!right) return left;
  const pad = Math.max(
    1,
    (process.stdout.columns ?? 80) -
      4 -
      stripAnsi(left).length -
      stripAnsi(right).length,
  );
  return left + " ".repeat(pad) + right;
}

const PROVIDERS: Record<string, { name: string; icon: string; color: string }> =
  {
    anthropic:       { name: "Anthropic", icon: "󰚩", color: GRV.orange  },
    "openai-codex":  { name: "OpenAI",    icon: "󰚩", color: GRV.green   },
    google:          { name: "Google",    icon: "󰊭", color: GRV.blue    },
    "github-copilot":{ name: "Copilot",   icon: "󰊤", color: GRV.purple  },
  };

const MODELS: Record<string, string> = {
  "claude-opus-4-6":                  "Opus 4.6",
  "claude-sonnet-4-6":                "Sonnet 4.6",
  "claude-haiku-4-5":                 "Haiku 4.5",
  "gpt-5.5":                          "GPT 5.5",
  "gemini-3.1-flash-lite-preview":    "Gemini 3.1 FL",
};

let isGitRepo: boolean | undefined = undefined;

function gitCache(
  cmd: string,
  ttl: number,
  fallback: string,
  tx: (s: string) => string,
) {
  let v = fallback,
    t = 0;
  return () => {
    if (isGitRepo === false) return fallback;
    const now = Date.now();
    if (now - t < ttl) return v;
    t = now;
    try {
      v = tx(execSync(cmd, { encoding: "utf8" }).trim());
      isGitRepo = true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("not a git repository")) isGitRepo = false;
      v = fallback;
    }
    return v;
  };
}
const gitBranch = gitCache(
  "git rev-parse --abbrev-ref HEAD",
  3_000,
  "",
  (s) => s,
);
function parseGitStatus(s: string): string {
  if (!s) return "";
  let staged = 0, unstaged = 0;
  for (const line of s.split("\n").filter(Boolean)) {
    const x = line[0], y = line[1];
    if (x === "?" && y === "?") continue;
    if (x !== " ") staged++;
    if (y !== " ") unstaged++;
  }
  const parts: string[] = [];
  if (staged)   parts.push(`\uF067${staged}`);
  if (unstaged) parts.push(`\uF040${unstaged}`);
  return parts.join(" ");
}
const gitDirty = gitCache("git status --porcelain", 10_000, "", parseGitStatus);

interface Totals {
  input: number;
  output: number;
  cost: number;
}

export default function (pi: ExtensionAPI) {
  const toolCounts = new Map<string, number>();
  let runningTotals: Totals = { input: 0, output: 0, cost: 0 };
  let cachedUsage: ReturnType<ExtensionContext["getContextUsage"]>;
  let lastKey = "";
  let lastActivityAt = 0,
    agentRunning = false;
  let idleTimer: ReturnType<typeof setInterval> | undefined;
  let savedCtx: ExtensionContext | undefined;

  function update(): void {
    if (!savedCtx) return;
    const ctx = savedCtx;

    const model = ctx.model;
    const prov = PROVIDERS[model?.provider ?? ""];
    const sep = c(GRV.bg3, " | ");

    const topLeft = [
      prov ? c(prov.color, `${prov.icon} ${prov.name}`) : "",
      c(GRV.yellow, MODELS[model?.id?.toLowerCase() ?? ""] ?? model?.id ?? "—"),
      c(GRV.gray,   `(${pi.getThinkingLevel()})`),
    ]
      .filter(Boolean)
      .join(sep);

    const branch = gitBranch(),
      dirty = gitDirty();
    const topRight = [
      c(GRV.orange, `\uF07B ${basename(ctx.cwd ?? "") || "root"}`),
      c(GRV.aqua,   `\uE0A0 ${branch || "no-git"}`)
        + (dirty ? " " + c(GRV.red, dirty) : ""),
    ].join(sep);

    cachedUsage ??= ctx.getContextUsage();
    const t = runningTotals;
    const pct = cachedUsage?.percent ?? null;
    const pctColor =
      pct === null || pct < 60
        ? GRV.green
        : pct < 80
          ? GRV.yellow
          : GRV.red;

    const idleMs = !agentRunning ? Date.now() - lastActivityAt : -1;
    const idleColor =
      idleMs < 0
        ? ""
        : idleMs < 180_000
          ? GRV.green
          : idleMs < 270_000
            ? GRV.yellow
            : idleMs < 300_000
              ? GRV.red
              : GRV.bg4;

    const div = c(GRV.bg3, " | ");
    const bottomLeft = [
      c(GRV.gray, `↑${fmt(t.input)}`),
      c(GRV.gray, `↓${fmt(t.output)}`),
      c(GRV.gray, t.cost < 0.01 ? `$${t.cost.toFixed(4)}` : `$${t.cost.toFixed(3)}`),
      pct !== null
        ? c(pctColor, `${Math.round(pct)}%`) +
          c(
            GRV.bg4,
            ` (${cachedUsage?.tokens != null ? fmt(cachedUsage.tokens) : "?"}/${cachedUsage ? fmt(cachedUsage.contextWindow) : "?"})`,
          )
        : "",
      idleMs >= 0 ? c(idleColor, `idle ${fmtIdle(idleMs)}`) : "",
    ]
      .filter(Boolean)
      .join(div);

    const bottomRight =
      toolCounts.size > 0
        ? [...toolCounts.entries()]
            .map(([n, cnt]) => c(GRV.gray, `${n} ${cnt}`))
            .join(c(GRV.bg3, " | "))
        : "";

    const key = topLeft + topRight + bottomLeft + bottomRight;
    if (key === lastKey) return;
    lastKey = key;

    ctx.ui.setWidget("status-top", [buildLine(topLeft, topRight)], {
      placement: "aboveEditor",
    });
    ctx.ui.setWidget(
      "status-bottom",
      [buildLine(bottomLeft, bottomRight), ""],
      { placement: "belowEditor" },
    );
  }

  pi.on("agent_start", () => {
    agentRunning = true;
  });
  pi.on("agent_end", () => {
    agentRunning = false;
    lastActivityAt = Date.now();
    update();
  });
  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    const u = (event.message as AssistantMessage).usage;
    if (!u) return;
    runningTotals.input  += u.input       ?? 0;
    runningTotals.output += u.output      ?? 0;
    runningTotals.cost   += u.cost?.total ?? 0;
  });
  pi.on("turn_end", () => {
    cachedUsage = undefined;
    update();
  });
  pi.on("model_select", () => update());
  pi.on("thinking_level_select", () => update());
  pi.on("tool_execution_start", (event) => {
    toolCounts.set(event.toolName, (toolCounts.get(event.toolName) ?? 0) + 1);
    update();
  });
  pi.on("session_shutdown", () => {
    clearInterval(idleTimer);
    idleTimer = undefined;
    savedCtx = undefined;
  });

  pi.on("session_start", (_event, ctx) => {
    savedCtx = ctx;
    toolCounts.clear();
    runningTotals = { input: 0, output: 0, cost: 0 };
    cachedUsage = undefined;
    lastActivityAt = Date.now();
    agentRunning = false;
    lastKey = "";
    isGitRepo = undefined;

    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      if (!agentRunning) update();
    }, 30_000);

    ctx.ui.setFooter(() => ({ render: () => [], invalidate() {} }));
    update();
  });
}
