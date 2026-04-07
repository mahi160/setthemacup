import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DB_PATH = join(homedir(), ".pi", "agent", "stats.db");

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  mkdirSync(join(homedir(), ".pi", "agent"), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  migrate(_db);
  return _db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT    PRIMARY KEY,
      started_at  INTEGER NOT NULL,
      ended_at    INTEGER,
      duration    INTEGER,
      cwd         TEXT,
      turns       INTEGER DEFAULT 0,
      tokens      INTEGER DEFAULT 0,
      cost        REAL    DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_models (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT    NOT NULL,
      provider    TEXT,
      model_id    TEXT,
      selected_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS session_tools (
      session_id  TEXT    NOT NULL,
      tool        TEXT    NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, tool)
    );

    CREATE TABLE IF NOT EXISTS session_commands (
      session_id  TEXT    NOT NULL,
      command     TEXT    NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, command)
    );

    CREATE TABLE IF NOT EXISTS session_skills (
      session_id  TEXT    NOT NULL,
      skill       TEXT    NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, skill)
    );
  `);
}

/* ---- writes ---- */

export function upsertSession(id: string, startedAt: number, cwd: string): void {
  getDb().prepare(
    `INSERT OR IGNORE INTO sessions (id, started_at, cwd) VALUES (?, ?, ?)`
  ).run(id, startedAt, cwd);
}

export function finalizeSession(
  id: string,
  endedAt: number,
  turns: number,
  tokens: number,
  cost: number,
  tools: Map<string, number>,
  commands: Map<string, number>,
  skills: Map<string, number>,
  models: Array<{ provider: string; modelId: string; selectedAt: number }>,
): void {
  const db = getDb();

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare(`
      UPDATE sessions
      SET ended_at = ?, duration = ? - started_at, turns = ?, tokens = ?, cost = ?
      WHERE id = ?
    `).run(endedAt, endedAt, turns, tokens, cost, id);

    const toolStmt = db.prepare(
      `INSERT OR REPLACE INTO session_tools (session_id, tool, count) VALUES (?, ?, ?)`
    );
    for (const [name, count] of tools) toolStmt.run(id, name, count);

    const cmdStmt = db.prepare(
      `INSERT OR REPLACE INTO session_commands (session_id, command, count) VALUES (?, ?, ?)`
    );
    for (const [name, count] of commands) cmdStmt.run(id, name, count);

    const skillStmt = db.prepare(
      `INSERT OR REPLACE INTO session_skills (session_id, skill, count) VALUES (?, ?, ?)`
    );
    for (const [name, count] of skills) skillStmt.run(id, name, count);

    const modelStmt = db.prepare(
      `INSERT INTO session_models (session_id, provider, model_id, selected_at) VALUES (?, ?, ?, ?)`
    );
    for (const m of models) modelStmt.run(id, m.provider, m.modelId, m.selectedAt);

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/* ---- queries ---- */

export interface OverallStats {
  totalSessions: number;
  totalTokens:   number;
  totalCost:     number;
  totalTurns:    number;
}

export interface ToolStat      { tool: string; total: number }
export interface ModelStat     { provider: string; model_id: string; uses: number }
export interface DailyStat     { day: string; tokens: number; sessions: number }
export interface RecentSession {
  id: string; started_at: number; duration: number | null;
  turns: number; tokens: number; cost: number; cwd: string | null;
}

export function getOverallStats(): OverallStats {
  return getDb().prepare(`
    SELECT
      COUNT(*)                 AS totalSessions,
      COALESCE(SUM(tokens), 0) AS totalTokens,
      COALESCE(SUM(cost),   0) AS totalCost,
      COALESCE(SUM(turns),  0) AS totalTurns
    FROM sessions WHERE ended_at IS NOT NULL
  `).get() as OverallStats;
}

export function getTopTools(limit = 8): ToolStat[] {
  return getDb().prepare(`
    SELECT tool, SUM(count) AS total
    FROM session_tools GROUP BY tool ORDER BY total DESC LIMIT ?
  `).all(limit) as ToolStat[];
}

export function getTopModels(limit = 6): ModelStat[] {
  return getDb().prepare(`
    SELECT provider, model_id, COUNT(DISTINCT session_id) AS uses
    FROM session_models GROUP BY provider, model_id ORDER BY uses DESC LIMIT ?
  `).all(limit) as ModelStat[];
}

export function getDailyStats(days = 30): DailyStat[] {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return getDb().prepare(`
    SELECT
      date(started_at / 1000, 'unixepoch') AS day,
      SUM(tokens) AS tokens,
      COUNT(*)    AS sessions
    FROM sessions
    WHERE started_at > ? AND ended_at IS NOT NULL
    GROUP BY day ORDER BY day
  `).all(since) as DailyStat[];
}

export function getRecentSessions(limit = 5): RecentSession[] {
  return getDb().prepare(`
    SELECT id, started_at, duration, turns, tokens, cost, cwd
    FROM sessions WHERE ended_at IS NOT NULL
    ORDER BY started_at DESC LIMIT ?
  `).all(limit) as RecentSession[];
}
