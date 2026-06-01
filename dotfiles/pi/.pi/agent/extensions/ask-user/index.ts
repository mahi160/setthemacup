import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { basename } from "node:path";
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

  invalidate(): void {}

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

// ── Overlay runner ─────────────────────────────────────────────────────────────

// Convert literal backslash escapes (\n, \t) that LLMs sometimes emit
// into real characters so multi-line questions render correctly.
function unescape(s: string): string {
  return s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

async function runOverlay(
  uiCtx: ExtensionContext,
  rawParams: {
    question: string;
    choices?: string[];
    default?: string;
    multiSelect?: boolean;
  },
): Promise<string> {
  const params = { ...rawParams, question: unescape(rawParams.question) };
  if (params.multiSelect && params.choices?.length) {
    const component = new MultiSelectComponent(params.choices);
    const result = await uiCtx.ui.custom<string | null>((tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
      container.addChild(new Text(theme.fg("accent", theme.bold(params.question)), 1, 0));
      container.addChild(new Spacer(1));
      const choicesContainer = new Container();
      choicesContainer.addChild({
        render: (w: number) => component.render(w),
        invalidate: () => component.invalidate(),
        handleInput: () => {},
      });
      container.addChild(choicesContainer);
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg("dim", "↑↓ navigate • space toggle • enter select • esc cancel"), 1, 0));
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
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
    return result ?? params.default ?? "";
  }

  if (params.choices?.length) {
    const result = await uiCtx.ui.select(params.question, params.choices);
    return result ?? params.default ?? params.choices[0] ?? "";
  }

  const ok = await uiCtx.ui.confirm("Question", params.question);
  return ok ? (params.default ?? "yes") : "no";
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  let sessionId = "unknown";
  let savedCtx: ExtensionContext | undefined;
  // Serial queue — only one overlay open at a time; concurrent asks wait their turn
  let uiQueue: Promise<void> = Promise.resolve();

  pi.on("session_start", (_, ctx: ExtensionContext) => {
    savedCtx = ctx;
    uiQueue = Promise.resolve(); // reset on new session
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
      "Single mode: pass 'question' (+ optional choices/multiSelect) — returns selected answer as string.",
      "Batch mode: pass 'questions' array — asks each in sequence, returns JSON array of {question, answer}.",
      "Use batch mode when you have several things to clarify at once.",
    ].join(" "),
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Single question to ask" })),
      choices: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Choices for the single question (omit for yes/no confirm)",
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
      questions: Type.Optional(
        Type.Array(
          Type.Object({
            question: Type.String({ description: "The question to ask" }),
            choices: Type.Optional(Type.Array(Type.String(), { description: "Answer choices; omit for yes/no confirm" })),
            default: Type.Optional(Type.String({ description: "Default if user presses Enter" })),
            multiSelect: Type.Optional(Type.Boolean({ description: "Allow picking multiple choices; returns comma-separated string" })),
          }),
          {
            description:
              "Batch mode: ask multiple questions in one call. Returns JSON array of {question, answer}. Use instead of 'question' when you have several things to ask at once.",
          },
        ),
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

      // ── Batch mode: multiple questions in one call ──────────────────────────
      // If both `question` and `questions` provided, merge — single goes first
      const allQuestions = [
        ...(params.question
          ? [{ question: params.question, choices: params.choices, default: params.default, multiSelect: params.multiSelect }]
          : []),
        ...(params.questions ?? []),
      ];

      if (allQuestions.length > 1 || (allQuestions.length === 1 && params.questions?.length)) {
        const results: Array<{ question: string; answer: string }> = [];

        for (const q of allQuestions) {
          let answer!: string;
          await new Promise<void>((resolveSlot) => {
            uiQueue = uiQueue.then(async () => {
              try {
                answer = await runOverlay(uiCtx, q);
              } catch {
                answer = q.default ?? "";
              } finally {
                resolveSlot();
              }
            });
          });
          tryRecordQna(sessionId, q.question, answer, q.choices ?? null);
          results.push({ question: q.question, answer });
        }

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
          details: {},
        };
      }

      // ── Single question mode (only `question`, no `questions`) ─────────────────────────────────────────────────
      if (!params.question) {
        return {
          content: [{ type: "text", text: params.default ?? "(no question provided)" }],
          details: {},
        };
      }

      let finalAnswer!: string;
      await new Promise<void>((resolveSlot) => {
        uiQueue = uiQueue.then(async () => {
          try {
            finalAnswer = await runOverlay(uiCtx, params as { question: string; choices?: string[]; default?: string; multiSelect?: boolean });
          } catch {
            finalAnswer = params.default ?? "";
          } finally {
            resolveSlot();
          }
        });
      });

      tryRecordQna(sessionId, params.question, finalAnswer, params.choices ?? null);
      return {
        content: [{ type: "text", text: finalAnswer }],
        details: {},
      };
    },
  });
}
