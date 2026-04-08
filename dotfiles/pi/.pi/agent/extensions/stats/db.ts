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

    CREATE TABLE IF NOT EXISTS user_inputs (
      id           TEXT    PRIMARY KEY,
      session_id   TEXT    NOT NULL,
      started_at   INTEGER NOT NULL,
      ended_at     INTEGER,
      time_ms      INTEGER,
      tokens_used  INTEGER DEFAULT 0,
      provider     TEXT,
      model_id     TEXT,
      tools        TEXT    DEFAULT '{}',
      commands     TEXT    DEFAULT '{}',
      skills       TEXT    DEFAULT '{}',
      cost_usd     REAL    DEFAULT 0
    );
  `);
}

/* ─── session writes ──────────────────────────────────────────────────────── */

export function upsertSession(id: string, startedAt: number, cwd: string): void {
  getDb()
    .prepare(`INSERT OR IGNORE INTO sessions (id, started_at, cwd) VALUES (?, ?, ?)`)
    .run(id, startedAt, cwd);
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
    db.prepare(
      `UPDATE sessions
       SET ended_at = ?, duration = ? - started_at, turns = ?, tokens = ?, cost = ?
       WHERE id = ?`,
    ).run(endedAt, endedAt, turns, tokens, cost, id);

    const toolStmt = db.prepare(
      `INSERT OR REPLACE INTO session_tools (session_id, tool, count) VALUES (?, ?, ?)`,
    );
    for (const [name, count] of tools) toolStmt.run(id, name, count);

    const cmdStmt = db.prepare(
      `INSERT OR REPLACE INTO session_commands (session_id, command, count) VALUES (?, ?, ?)`,
    );
    for (const [name, count] of commands) cmdStmt.run(id, name, count);

    const skillStmt = db.prepare(
      `INSERT OR REPLACE INTO session_skills (session_id, skill, count) VALUES (?, ?, ?)`,
    );
    for (const [name, count] of skills) skillStmt.run(id, name, count);

    const modelStmt = db.prepare(
      `INSERT INTO session_models (session_id, provider, model_id, selected_at) VALUES (?, ?, ?, ?)`,
    );
    for (const m of models) modelStmt.run(id, m.provider, m.modelId, m.selectedAt);

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/* ─── per-input writes ────────────────────────────────────────────────────── */

export interface InputRecord {
  id: string;
  sessionId: string;
  startedAt: number;
  provider: string;
  modelId: string;
}

export function createInputRecord(record: InputRecord): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO user_inputs
         (id, session_id, started_at, provider, model_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(record.id, record.sessionId, record.startedAt, record.provider, record.modelId);
}

export function finalizeInputRecord(
  id: string,
  endedAt: number,
  timeMs: number,
  tokensUsed: number,
  tools: Map<string, number>,
  commands: Map<string, number>,
  skills: Map<string, number>,
  costUsd: number,
): void {
  getDb()
    .prepare(
      `UPDATE user_inputs
       SET ended_at = ?, time_ms = ?, tokens_used = ?,
           tools = ?, commands = ?, skills = ?, cost_usd = ?
       WHERE id = ?`,
    )
    .run(
      endedAt,
      timeMs,
      tokensUsed,
      JSON.stringify(Object.fromEntries(tools)),
      JSON.stringify(Object.fromEntries(commands)),
      JSON.stringify(Object.fromEntries(skills)),
      costUsd,
      id,
    );
}

/* ─── query interfaces ────────────────────────────────────────────────────── */

export interface OverallStats {
  totalSessions: number;
  totalTokens:   number;
  totalCost:     number;
  totalTurns:    number;
}

export interface WeeklyStat {
  inputs:   number;
  sessions: number;
  tokens:   number;
  timeMs:   number;
  cost:     number;
}

export interface ToolStat {
  tool:  string;
  total: number;
}

export interface ModelStat {
  provider: string;
  model_id: string;
  uses:     number;
}

export interface DailyStat {
  day:      string;
  tokens:   number;
  sessions: number;
  inputs:   number;
}

export interface ProjectStat {
  project: string;
  inputs:  number;
}

export interface RecentSession {
  id:         string;
  started_at: number;
  duration:   number | null;
  turns:      number;
  tokens:     number;
  cost:       number;
  cwd:        string | null;
  inputs:     number;
}

/* ─── queries ─────────────────────────────────────────────────────────────── */

export function getOverallStats(): OverallStats {
  return getDb()
    .prepare(
      `SELECT
         COUNT(*)                 AS totalSessions,
         COALESCE(SUM(tokens), 0) AS totalTokens,
         COALESCE(SUM(cost),   0) AS totalCost,
         COALESCE(SUM(turns),  0) AS totalTurns
       FROM sessions WHERE ended_at IS NOT NULL`,
    )
    .get() as OverallStats;
}

export function getWeeklyStats(startTs: number, endTs: number): WeeklyStat {
  return (
    getDb()
      .prepare(
        `SELECT
           COUNT(DISTINCT session_id)  AS sessions,
           COUNT(id)                   AS inputs,
           COALESCE(SUM(tokens_used),0) AS tokens,
           COALESCE(SUM(time_ms),    0) AS timeMs,
           COALESCE(SUM(cost_usd),   0) AS cost
         FROM user_inputs
         WHERE started_at >= ? AND started_at < ? AND ended_at IS NOT NULL`,
      )
      .get(startTs, endTs) as WeeklyStat
  ) ?? { sessions: 0, inputs: 0, tokens: 0, timeMs: 0, cost: 0 };
}

/** Top tools aggregated from per-input JSON (reflects actual LLM usage). */
export function getTopToolsByInputs(sinceTs = 0, limit = 10): ToolStat[] {
  return getDb()
    .prepare(
      `SELECT je.key AS tool, SUM(CAST(je.value AS INTEGER)) AS total
       FROM user_inputs
       CROSS JOIN json_each(user_inputs.tools) AS je
       WHERE user_inputs.started_at > ? AND user_inputs.ended_at IS NOT NULL
       GROUP BY je.key
       ORDER BY total DESC
       LIMIT ?`,
    )
    .all(sinceTs, limit) as ToolStat[];
}

/** Models ranked by number of inputs (not sessions). */
export function getTopModelsByInputs(limit = 6): ModelStat[] {
  return getDb()
    .prepare(
      `SELECT provider, model_id, COUNT(*) AS uses
       FROM user_inputs
       WHERE ended_at IS NOT NULL
       GROUP BY provider, model_id
       ORDER BY uses DESC
       LIMIT ?`,
    )
    .all(limit) as ModelStat[];
}

/** Top projects by input count. */
export function getTopProjects(limit = 8): ProjectStat[] {
  const rows = getDb()
    .prepare(
      `SELECT s.cwd, COUNT(ui.id) AS inputs
       FROM user_inputs ui
       JOIN sessions s ON ui.session_id = s.id
       WHERE ui.ended_at IS NOT NULL
       GROUP BY s.cwd
       ORDER BY inputs DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{ cwd: string | null; inputs: number }>;

  return rows.map((r) => ({
    project: r.cwd?.split("/").pop() ?? r.cwd ?? "—",
    inputs: r.inputs,
  }));
}

export function getDailyStats(days = 30): DailyStat[] {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return getDb()
    .prepare(
      `SELECT
         date(s.started_at / 1000, 'unixepoch') AS day,
         COALESCE(SUM(s.tokens),  0) AS tokens,
         COUNT(DISTINCT s.id)        AS sessions,
         COUNT(ui.id)                AS inputs
       FROM sessions s
       LEFT JOIN user_inputs ui ON ui.session_id = s.id
       WHERE s.started_at > ? AND s.ended_at IS NOT NULL
       GROUP BY day ORDER BY day`,
    )
    .all(since) as DailyStat[];
}

/** Legacy — kept for session-level tool chart (all-time). */
export function getTopTools(limit = 8): ToolStat[] {
  return getDb()
    .prepare(
      `SELECT tool, SUM(count) AS total
       FROM session_tools GROUP BY tool ORDER BY total DESC LIMIT ?`,
    )
    .all(limit) as ToolStat[];
}

/** Legacy — kept for session-level model chart. */
export function getTopModels(limit = 6): ModelStat[] {
  return getDb()
    .prepare(
      `SELECT provider, model_id, COUNT(DISTINCT session_id) AS uses
       FROM session_models GROUP BY provider, model_id ORDER BY uses DESC LIMIT ?`,
    )
    .all(limit) as ModelStat[];
}

export function getRecentSessions(limit = 6): RecentSession[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.started_at, s.duration, s.turns, s.tokens, s.cost, s.cwd,
              COUNT(ui.id) AS inputs
       FROM sessions s
       LEFT JOIN user_inputs ui ON ui.session_id = s.id AND ui.ended_at IS NOT NULL
       WHERE s.ended_at IS NOT NULL
       GROUP BY s.id
       ORDER BY s.started_at DESC LIMIT ?`,
    )
    .all(limit) as RecentSession[];
}
