import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { closeDb, emptyRun, foldMessages, openDb, saveCompaction, saveRun } from "./db.ts";
import { buildHtml, money, startOfToday, tokens, totals } from "./report.ts";

export default function (pi: ExtensionAPI): void {
  let startedAt = 0;

  pi.on("session_start", () => {
    openDb();
  });

  pi.on("agent_start", () => {
    startedAt = Date.now();
  });

  pi.on("agent_end", (event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    const run = emptyRun(randomUUID(), sessionId, ctx.cwd, startedAt || Date.now());
    saveRun(openDb(), foldMessages(run, event.messages));
  });

  pi.on("session_compact", (event, ctx) => {
    const e = event.compactionEntry;
    saveCompaction(openDb(), e.id, ctx.sessionManager.getSessionId(), Date.parse(e.timestamp) || Date.now(), e.tokensBefore, e.usage?.cost.total ?? 0);
  });

  pi.on("session_shutdown", () => {
    closeDb();
  });

  pi.registerCommand("stat", {
    description: "Open usage stats dashboard in browser",
    handler: async (_args, ctx) => {
      const path = join(tmpdir(), "pi-stats.html");
      writeFileSync(path, buildHtml(openDb()), "utf8");
      execFile(process.platform === "darwin" ? "open" : "xdg-open", [path]).on("error", () => {});
      ctx.ui.notify(`Stats: ${path}`, "info");
    },
  });

  pi.registerCommand("cost", {
    description: "Show today's cost",
    handler: async (_args, ctx) => {
      const t = totals(openDb(), startOfToday());
      ctx.ui.notify(`Today: ${money(t.cost)} · ${t.runs} prompts · ${tokens(t.tokens)} tok`, "info");
    },
  });
}
