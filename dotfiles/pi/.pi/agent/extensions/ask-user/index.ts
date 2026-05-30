import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { basename } from "node:path";
import { execFile } from "node:child_process";
import {
  matchesKey,
  Key,
  truncateToWidth,
  type Component,
  Container,
  Text,
  Spacer,
} from "@earendil-works/pi-tui";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";

function notifyQuestion(question: string): void {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `display notification "${esc(question.slice(0, 100))}" with title "π ??" subtitle "Waiting for your input" sound name "Ping"`;
  execFile("osascript", ["-e", script], { timeout: 5_000 }, () => {});
}

// Multi-select checkbox component
class MultiSelectComponent implements Component {
  private items: string[];
  private selected: Set<number> = new Set();
  private focused = 0;

  constructor(items: string[]) {
    this.items = items;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.focused = Math.max(0, this.focused - 1);
    } else if (matchesKey(data, Key.down)) {
      this.focused = Math.min(this.items.length - 1, this.focused + 1);
    } else if (matchesKey(data, Key.space)) {
      if (this.selected.has(this.focused)) {
        this.selected.delete(this.focused);
      } else {
        this.selected.add(this.focused);
      }
    }
  }

  render(width: number): string[] {
    return this.items.map((item, i) => {
      const checkbox = this.selected.has(i) ? "☑" : "☐";
      const prefix = i === this.focused ? "> " : "  ";
      return truncateToWidth(`${prefix}${checkbox} ${item}`, width);
    });
  }

  invalidate(): void {
    // no cache
  }

  getSelected(): string[] {
    return Array.from(this.selected)
      .sort((a, b) => a - b)
      .map((i) => this.items[i]);
  }
}

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
      multiSelect: Type.Optional(
        Type.Boolean({
          description:
            "If true, allow selecting multiple items (space to toggle, enter to confirm). Returns comma-separated string.",
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
          content: [{
            type: "text",
            text: params.default ?? params.choices?.[0] ?? "(no UI available)",
          }],
          details: {},
        };
      }

      notifyQuestion(params.question);

      let finalAnswer: string;

      if (params.multiSelect && params.choices?.length) {
        // Multi-select mode
        const component = new MultiSelectComponent(params.choices);
        const result = await uiCtx.ui.custom<string | null>((tui, theme, _kb, done) => {
          const container = new Container();
          
          // Top border
          container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
          
          // Title
          container.addChild(new Text(theme.fg("accent", theme.bold(params.question)), 1, 0));
          
          // Spacer
          container.addChild(new Spacer(1));
          
          // Choices container
          const choicesContainer = new Container();
          choicesContainer.addChild({
            render: (w: number) => component.render(w),
            invalidate: () => component.invalidate(),
            handleInput: () => {},
          });
          container.addChild(choicesContainer);
          
          // Bottom spacer
          container.addChild(new Spacer(1));
          
          // Help text
          container.addChild(new Text(theme.fg("dim", "↑↓ navigate • space toggle • enter select • esc cancel"), 1, 0));
          
          // Bottom border
          container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
          
          // Bottom padding
          container.addChild(new Spacer(1));
          
          return {
            render: (w) => container.render(w),
            invalidate: () => container.invalidate(),
            handleInput: (data) => {
              if (matchesKey(data, Key.enter)) {
                const selected = component.getSelected();
                done(selected.length > 0 ? selected.join(",") : null);
              } else if (matchesKey(data, Key.escape)) {
                done(null);
              } else {
                component.handleInput(data);
                tui.requestRender();
              }
            },
          };
        });
        finalAnswer = result ?? params.default ?? "";
      } else if (params.choices?.length) {
        const result = await uiCtx.ui.select(params.question, params.choices);
        finalAnswer = result ?? params.default ?? params.choices[0] ?? "";
      } else {
        const ok = await uiCtx.ui.confirm("Question", params.question);
        finalAnswer = ok ? (params.default ?? "yes") : "no";
      }

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
