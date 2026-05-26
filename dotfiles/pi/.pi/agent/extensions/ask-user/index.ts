import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { basename } from "node:path";

let _recordQna:
  | ((s: string, q: string, a: string, c: string[] | null) => void)
  | null = null;
function tryRecordQna(
  sessionId: string,
  question: string,
  answer: string,
  choices: string[] | null,
): void {
  try {
    if (!_recordQna) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const db = require("../stats/db.js") as { recordQna: typeof _recordQna };
      _recordQna = db.recordQna;
    }
    _recordQna?.(sessionId, question, answer, choices);
  } catch {
    /* stats DB unavailable */
  }
}

// ── Ask-user overlay component ────────────────────────────────────────────────

interface AskParams {
  question: string;
  choices?: string[];
  default?: string;
  allowFreeText?: boolean;
}

class AskUserOverlay implements Component {
  private selected = 0;
  private onDone: (answer: string | null) => void;
  private params: AskParams;
  private theme: Theme;

  constructor(
    params: AskParams,
    theme: Theme,
    onDone: (answer: string | null) => void,
  ) {
    this.params = params;
    this.theme = theme;
    this.onDone = onDone;
    if (params.default && params.choices) {
      const idx = params.choices.indexOf(params.default);
      if (idx >= 0) this.selected = idx;
    }
  }

  render(width: number): string[] {
    const t = this.theme;
    const { question, choices, default: def } = this.params;
    const inner = Math.max(0, width - 4);

    const truncate = (s: string, max: number) =>
      s.length > max ? s.slice(0, max - 1) + "…" : s;

    const border = (s: string) => t.fg("borderMuted", s);
    const line = (content: string) => {
      const visible = content.replace(/\x1b\[[^m]*m/g, "");
      const pad = Math.max(0, inner - visible.length);
      return border("│ ") + content + " ".repeat(pad) + border(" │");
    };

    const hr = border("├" + "─".repeat(Math.max(0, width - 2)) + "┤");

    const rows: string[] = [
      border("╭" + "─".repeat(Math.max(0, width - 2)) + "╮"),
      line(t.fg("accent", "  Ask")),
      hr,
      line("  " + truncate(question, inner - 2)),
    ];

    if (choices?.length) {
      rows.push(line(""));
      choices.forEach((c, i) => {
        const num = t.fg("muted", `${i + 1}`);
        const isSelected = i === this.selected;
        const label = isSelected ? t.fg("success", `▶ ${c}`) : `  ${c}`;
        const isDefault = c === def;
        const suffix = isDefault ? t.fg("dim", " (default)") : "";
        rows.push(line(`  ${num}  ${label}${suffix}`));
      });
      rows.push(line(""));
      rows.push(
        line(t.fg("dim", "  ↑↓ navigate · Enter confirm · Esc cancel")),
      );
    } else {
      rows.push(line(""));
      rows.push(line(t.fg("dim", "  Press Enter to confirm · Esc to cancel")));
    }

    rows.push(border("╰" + "─".repeat(Math.max(0, width - 2)) + "╯"));
    return rows;
  }

  handleInput(data: string): void {
    const { choices } = this.params;

    if (data === "\r" || data === "\n") {
      const answer = choices?.length
        ? (choices[this.selected] ?? this.params.default ?? "")
        : (this.params.default ?? "");
      this.onDone(answer);
      return;
    }

    if (data === "\x1b" || data === "\x1b\x1b") {
      const fallback = this.params.default ?? choices?.[0] ?? "";
      this.onDone(fallback);
      return;
    }

    if (choices?.length) {
      const n = parseInt(data, 10);
      if (!isNaN(n) && n >= 1 && n <= choices.length) {
        this.selected = n - 1;
        return;
      }
      if (data === "\x1b[A" || data === "k") {
        this.selected = Math.max(0, this.selected - 1);
      } else if (data === "\x1b[B" || data === "j") {
        this.selected = Math.min(choices.length - 1, this.selected + 1);
      }
    }
  }

  invalidate(): void {}
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  let sessionId = "unknown";
  let savedCtx: ExtensionContext | undefined;

  pi.on("session_start", (_, ctx: ExtensionContext) => {
    savedCtx = ctx;
    try {
      const file = ctx.sessionManager.getSessionFile();
      sessionId = file ? basename(file, ".jsonl") : `ephemeral_${Date.now()}`;
    } catch {
      sessionId = `ephemeral_${Date.now()}`;
    }
  });

  pi.registerTool({
    name: "ask_user",
    label: "Ask User",
    description: [
      "Ask the user a structured clarifying question via a keyboard-driven overlay.",
      "Use when multiple valid interpretations exist and a choice must be made.",
      "Always prefer this over asking in prose.",
      "Returns the user's selected answer as a string.",
    ].join(" "),
    parameters: Type.Object({
      question: Type.String({ description: "The question to ask the user" }),
      choices: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "List of answer choices (if omitted, user can press Enter to confirm or Esc to cancel)",
        }),
      ),
      default: Type.Optional(
        Type.String({
          description: "Default answer if user presses Enter without selecting",
        }),
      ),
      allowFreeText: Type.Optional(
        Type.Boolean({
          description: "Unused in current impl — choices are keyboard-driven",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const uiCtx = ctx ?? savedCtx;
      if (!uiCtx) {
        return {
          content: [
            {
              type: "text",
              text:
                params.default ?? params.choices?.[0] ?? "(no UI available)",
            },
          ],
          details: {},
        };
      }

      let answer: string | null = null;

      await uiCtx.ui.custom<string | null>(
        (_tui, theme, _kb, done) => {
          const overlay = new AskUserOverlay(
            params as AskParams,
            theme,
            (result) => {
              answer = result;
              done(result);
            },
          );
          return overlay;
        },
        {
          overlay: true,
          overlayOptions: { width: "55%", anchor: "center" },
        },
      );

      const finalAnswer = answer ?? params.default ?? params.choices?.[0] ?? "";
      tryRecordQna(
        sessionId,
        params.question,
        finalAnswer,
        params.choices ?? null,
      );

      return {
        content: [{ type: "text", text: finalAnswer }],
        details: {},
      };
    },
  });
}
