import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export type Run = {
  id: string;
  sessionId: string;
  cwd: string;
  startedAt: number;
  endedAt: number;
  provider: string;
  model: string;
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  tools: Record<string, number>;
  error: string | null;
};

type Msg = {
  role?: string;
  provider?: string;
  model?: string;
  timestamp?: number;
  stopReason?: string;
  errorMessage?: string;
  content?: unknown;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    cost?: { total?: number };
  };
};

const SCHEMA_VERSION = 1;
let db: DatabaseSync | undefined;

export function openDb(): DatabaseSync {
  if (db) return db;
  db = new DatabaseSync(join(getAgentDir(), "pi-stats.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, cwd TEXT NOT NULL DEFAULT '',
      started_at INTEGER NOT NULL, ended_at INTEGER NOT NULL,
      provider TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '',
      requests INTEGER NOT NULL DEFAULT 0,
      input INTEGER NOT NULL DEFAULT 0, output INTEGER NOT NULL DEFAULT 0,
      cache_read INTEGER NOT NULL DEFAULT 0, cache_write INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0, tools TEXT NOT NULL DEFAULT '{}', error TEXT
    );
    CREATE INDEX IF NOT EXISTS runs_started ON runs (started_at);
    CREATE TABLE IF NOT EXISTS compactions (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, at INTEGER NOT NULL,
      tokens_before INTEGER NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0
    );
  `);
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (user_version < SCHEMA_VERSION) {
    migrate(db);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
  return db;
}

export function closeDb(): void {
  db?.close();
  db = undefined;
}

// One run = one user prompt through agent_end. Folds assistant messages into totals.
export function foldMessages(run: Run, messages: unknown[]): Run {
  for (const m of messages as Msg[]) {
    if (m?.role !== "assistant") continue;
    const u = m.usage ?? {};
    run.requests += 1;
    run.input += u.input ?? 0;
    run.output += u.output ?? 0;
    run.cacheRead += u.cacheRead ?? 0;
    run.cacheWrite += u.cacheWrite ?? 0;
    run.cost += u.cost?.total ?? 0;
    run.provider = m.provider ?? run.provider;
    run.model = m.model ?? run.model;
    if (m.timestamp) run.endedAt = Math.max(run.endedAt, m.timestamp);
    run.error =
      m.stopReason === "error" || m.stopReason === "aborted"
        ? (m.errorMessage ?? m.stopReason).slice(0, 300)
        : null;
    if (Array.isArray(m.content)) {
      for (const b of m.content as { type?: string; name?: string }[]) {
        if (b?.type === "toolCall" && b.name) run.tools[b.name] = (run.tools[b.name] ?? 0) + 1;
      }
    }
  }
  return run;
}

export function emptyRun(id: string, sessionId: string, cwd: string, startedAt: number): Run {
  return {
    id, sessionId, cwd, startedAt, endedAt: startedAt, provider: "", model: "",
    requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, tools: {}, error: null,
  };
}

export function saveRun(d: DatabaseSync, r: Run): void {
  if (r.requests === 0) return;
  d.prepare(
    `INSERT OR IGNORE INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    r.id, r.sessionId, r.cwd, r.startedAt, r.endedAt, r.provider, r.model, r.requests,
    r.input, r.output, r.cacheRead, r.cacheWrite, r.cost, JSON.stringify(r.tools), r.error,
  );
}

export function saveCompaction(
  d: DatabaseSync, id: string, sessionId: string, at: number, tokensBefore: number, cost: number,
): void {
  d.prepare("INSERT OR IGNORE INTO compactions VALUES (?,?,?,?,?)").run(id, sessionId, at, tokensBefore, cost);
}

// One-time import from transcripts.
function migrate(d: DatabaseSync): void {
  d.exec("BEGIN");
  try {
    backfillSessions(d, join(getAgentDir(), "sessions"));
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

function backfillSessions(d: DatabaseSync, root: string): void {
  if (!existsSync(root)) return;
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const file of readdirSync(join(root, dir.name))) {
      if (!file.endsWith(".jsonl")) continue;
      const lines = readFileSync(join(root, dir.name, file), "utf8").split("\n");
      let sessionId = "";
      let cwd = "";
      let run: Run | undefined;
      for (const line of lines) {
        if (!line) continue;
        let e: { type?: string; id?: string; cwd?: string; timestamp?: string; tokensBefore?: number; usage?: Msg["usage"]; message?: Msg };
        try {
          e = JSON.parse(line);
        } catch {
          continue;
        }
        if (e.type === "session") {
          sessionId = e.id ?? file;
          cwd = e.cwd ?? "";
        } else if (e.type === "compaction" && e.id) {
          saveCompaction(d, e.id, sessionId, Date.parse(e.timestamp ?? "") || 0, e.tokensBefore ?? 0, e.usage?.cost?.total ?? 0);
        } else if (e.type === "message" && e.message?.role === "user") {
          if (run) saveRun(d, run);
          run = emptyRun(`${sessionId}:${e.id}`, sessionId, cwd, Date.parse(e.timestamp ?? "") || 0);
        } else if (e.type === "message" && run) {
          foldMessages(run, [e.message]);
        }
      }
      if (run) saveRun(d, run);
    }
  }
}
