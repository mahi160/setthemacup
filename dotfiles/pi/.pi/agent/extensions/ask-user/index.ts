import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { basename } from "node:path";
import { execFile } from "node:child_process";

function notifyQuestion(question: string): void {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `display notification "${esc(question.slice(0, 100))}" with title "π ??" subtitle "Waiting for your input" sound name "Ping"`;
  execFile("osascript", ["-e", script], { timeout: 5_000 }, () => {});
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

      if (params.choices?.length) {
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
