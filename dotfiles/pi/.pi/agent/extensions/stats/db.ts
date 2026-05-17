/**
 * db.ts — SQLite schema, migrations, writes, and queries.
 *
 * Uses node:sqlite (built-in Node 22.5+). No npm install needed.
 * DB path: ~/.pi/agent/stats.db
 *
 * Tables:
 *   sessions         — one row per pi session (lifecycle aggregates)
 *   session_models   — model switches within a session
 *   session_tools    — tool usage aggregated per session
 *   session_commands — slash commands used per session
 *   session_skills   — skills used per session
 *   user_inputs      — one row per user prompt (timing, tokens, cost, tools)
 *   compactions      — compaction events (tokens saved)
 *   errors           — failed requests / aborted turns
 */

// node:sqlite is built-in (Node 22.5+). Dynamic require avoids TS resolution errors.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => SqlDb;
};

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Minimal node:sqlite types ─────────────────────────────────────────────────

interface SqlStmt {
  run(...p: unknown[]): void;
  get(...p: unknown[]): Record<string, unknown> | undefined;
  all(...p: unknown[]): Record<string, unknown>[];
}
interface SqlDb {
  exec(sql: string): void;
  prepare(sql: string): SqlStmt;
  close(): void;
}

// ── Path ──────────────────────────────────────────────────────────────────────

export const DB_PATH = join(homedir(), ".pi", "agent", "stats.db");

// ── Schema types ──────────────────────────────────────────────────────────────

export interface OverallStats {
  totalSessions: number;
  totalTokens: number;
  totalCost: number;
  totalTurns: number;
  totalInputs: number;
}

export interface WeeklyStat {
  inputs: number;
  sessions: number;
  tokens: number;
  timeMs: number;
  cost: number;
}

export interface ToolStat {
  tool: string;
  total: number;
}

export interface ModelStat {
  provider: string;
  model_id: string;
  uses: number;
}

export interface ModelEfficiency {
  provider: string;
  model_id: string;
  inputs: number;
  avgTokens: number;
  avgTimeSec: number;
  costPerInput: number;
  totalCost: number;
}

export interface DailyStat {
  day: string;
  tokens: number;
  sessions: number;
  inputs: number;
}

export interface DailyCost {
  day: string;
  cost: number;
}

export interface ProjectStat {
  project: string;
  inputs: number;
}

export interface RecentSession {
  id: string;
  started_at: number;
  duration: number | null;
  turns: number;
  tokens: number;
  cost: number;
  cwd: string | null;
  inputs: number;
}

export interface DurationBucket {
  label: string;
  count: number;
}

export interface TokenWasteEntry {
  id: string;
  tokens_used: number;
  time_ms: number;
  provider: string;
  model_id: string;
  started_at: number;
}

export interface TokenBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface CacheRatio {
  cacheRead: number;
  totalInput: number;
  ratio: number;
}

export interface CompactionRecord {
  id: number;
  sessionId: string;
  compactedAt: number;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
}

export interface ErrorRecord {
  id: number;
  sessionId: string;
  occurredAt: number;
  errorType: string;
  modelId: string;
  message: string;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _db: SqlDb | undefined;

export function closeDb(): void {
  if (!_db) return;
  try { _db.close(); } catch { /* ignore */ }
  _db = undefined;
}

export function getDb(): SqlDb {
  if (_db) return _db;
  mkdirSync(join(homedir(), ".pi", "agent"), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  migrate(_db);
  return _db;
}

// ── Migrations ────────────────────────────────────────────────────────────────

function migrate(db: SqlDb): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous  = NORMAL;

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
      session_id TEXT NOT NULL,
      tool       TEXT NOT NULL,
      count      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, tool)
    );

    CREATE TABLE IF NOT EXISTS session_commands (
      session_id TEXT NOT NULL,
      command    TEXT NOT NULL,
      count      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, command)
    );

    CREATE TABLE IF NOT EXISTS session_skills (
      session_id TEXT NOT NULL,
      skill      TEXT NOT NULL,
      count      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, skill)
    );

    CREATE TABLE IF NOT EXISTS user_inputs (
      id                  TEXT    PRIMARY KEY,
      session_id          TEXT    NOT NULL,
      started_at          INTEGER NOT NULL,
      ended_at            INTEGER,
      time_ms             INTEGER,
      tokens_used         INTEGER DEFAULT 0,
      tokens_input        INTEGER DEFAULT 0,
      tokens_output       INTEGER DEFAULT 0,
      tokens_cache_read   INTEGER DEFAULT 0,
      tokens_cache_write  INTEGER DEFAULT 0,
      provider            TEXT,
      model_id            TEXT,
      branch              TEXT    DEFAULT '',
      tools               TEXT    DEFAULT '{}',
      commands            TEXT    DEFAULT '{}',
      skills              TEXT    DEFAULT '{}',
      cost_usd            REAL    DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS compactions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT    NOT NULL,
      compacted_at  INTEGER NOT NULL,
      tokens_before INTEGER DEFAULT 0,
      tokens_after  INTEGER DEFAULT 0,
      tokens_saved  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS errors (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT    NOT NULL,
      occurred_at INTEGER NOT NULL,
      error_type  TEXT    DEFAULT '',
      model_id    TEXT    DEFAULT '',
      message     TEXT    DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_ui_session   ON user_inputs  (session_id);
    CREATE INDEX IF NOT EXISTS idx_ui_started   ON user_inputs  (started_at);
    CREATE INDEX IF NOT EXISTS idx_sess_started ON sessions     (started_at);
    CREATE INDEX IF NOT EXISTS idx_comp_sess    ON compactions  (session_id);
    CREATE INDEX IF NOT EXISTS idx_err_sess     ON errors       (session_id);
  `);

  // Additive migrations for DBs created by older versions
  const addCol = (table: string, col: string, def: string) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch { /* exists */ }
  };
  addCol("user_inputs", "tokens_input",       "INTEGER DEFAULT 0");
  addCol("user_inputs", "tokens_output",      "INTEGER DEFAULT 0");
  addCol("user_inputs", "tokens_cache_read",  "INTEGER DEFAULT 0");
  addCol("user_inputs", "tokens_cache_write", "INTEGER DEFAULT 0");
  addCol("user_inputs", "branch",             "TEXT DEFAULT ''");
}

// ── Writes ────────────────────────────────────────────────────────────────────

export function upsertSession(id: string, startedAt: number, cwd: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO sessions (id, started_at, cwd) VALUES (?, ?, ?)")
    .run(id, startedAt, cwd);
}

export function finalizeSession(
  id: string,
  endedAt: number,
  turns: number,
  tokens: number,
  tools: Map<string, number>,
  commands: Map<string, number>,
  skills: Map<string, number>,
  models: Array<{ provider: string; modelId: string; selectedAt: number }>,
): void {
  const db = getDb();
  db.exec("BEGIN TRANSACTION");
  try {
    const row = db
      .prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM user_inputs WHERE session_id=? AND ended_at IS NOT NULL")
      .get(id) as { total: number } | undefined;

    db.prepare("UPDATE sessions SET ended_at=?, duration=?-started_at, turns=?, tokens=?, cost=? WHERE id=?")
      .run(endedAt, endedAt, turns, tokens, row?.total ?? 0, id);

    const tStmt = db.prepare("INSERT OR REPLACE INTO session_tools    (session_id,tool,count)    VALUES (?,?,?)");
    const cStmt = db.prepare("INSERT OR REPLACE INTO session_commands (session_id,command,count) VALUES (?,?,?)");
    const sStmt = db.prepare("INSERT OR REPLACE INTO session_skills   (session_id,skill,count)   VALUES (?,?,?)");
    const mStmt = db.prepare("INSERT INTO session_models (session_id,provider,model_id,selected_at) VALUES (?,?,?,?)");

    for (const [k, v] of tools) tStmt.run(id, k, v);
    for (const [k, v] of commands) cStmt.run(id, k, v);
    for (const [k, v] of skills) sStmt.run(id, k, v);
    for (const m of models) mStmt.run(id, m.provider, m.modelId, m.selectedAt);

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function createInputRecord(r: {
  id: string;
  sessionId: string;
  startedAt: number;
  provider: string;
  modelId: string;
  branch: string;
}): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO user_inputs (id, session_id, started_at, provider, model_id, branch) VALUES (?,?,?,?,?,?)")
    .run(r.id, r.sessionId, r.startedAt, r.provider, r.modelId, r.branch);
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
  tokensInput: number,
  tokensOutput: number,
  tokensCacheRead: number,
  tokensCacheWrite: number,
): void {
  getDb()
    .prepare(`
      UPDATE user_inputs
      SET ended_at=?, time_ms=?,
          tokens_used=?, tokens_input=?, tokens_output=?,
          tokens_cache_read=?, tokens_cache_write=?,
          tools=?, commands=?, skills=?, cost_usd=?
      WHERE id=?
    `)
    .run(
      endedAt, timeMs,
      tokensUsed, tokensInput, tokensOutput,
      tokensCacheRead, tokensCacheWrite,
      JSON.stringify(Object.fromEntries(tools)),
      JSON.stringify(Object.fromEntries(commands)),
      JSON.stringify(Object.fromEntries(skills)),
      costUsd, id,
    );
}

export function recordCompaction(
  sessionId: string,
  tokensBefore: number,
  tokensAfter: number,
): void {
  getDb()
    .prepare("INSERT INTO compactions (session_id, compacted_at, tokens_before, tokens_after, tokens_saved) VALUES (?,?,?,?,?)")
    .run(sessionId, Date.now(), tokensBefore, tokensAfter, Math.max(0, tokensBefore - tokensAfter));
}

export function recordError(
  sessionId: string,
  errorType: string,
  modelId: string,
  message: string,
): void {
  getDb()
    .prepare("INSERT INTO errors (session_id, occurred_at, error_type, model_id, message) VALUES (?,?,?,?,?)")
    .run(sessionId, Date.now(), errorType, modelId, message.slice(0, 500));
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getOverallStats(): OverallStats {
  return getDb()
    .prepare(`
      SELECT COUNT(*)                  AS totalSessions,
             COALESCE(SUM(tokens), 0)  AS totalTokens,
             COALESCE(SUM(cost), 0)    AS totalCost,
             COALESCE(SUM(turns), 0)   AS totalTurns,
             (SELECT COUNT(*) FROM user_inputs WHERE ended_at IS NOT NULL) AS totalInputs
      FROM sessions WHERE ended_at IS NOT NULL AND turns > 0
    `)
    .get() as OverallStats;
}

export function getWeeklyStats(startTs: number, endTs: number): WeeklyStat {
  return (getDb()
    .prepare(`
      SELECT COUNT(DISTINCT session_id) AS sessions,
             COUNT(id)                  AS inputs,
             COALESCE(SUM(tokens_used), 0) AS tokens,
             COALESCE(SUM(time_ms), 0)     AS timeMs,
             COALESCE(SUM(cost_usd), 0)    AS cost
      FROM user_inputs
      WHERE started_at >= ? AND started_at < ? AND ended_at IS NOT NULL
    `)
    .get(startTs, endTs) as WeeklyStat) ?? { sessions: 0, inputs: 0, tokens: 0, timeMs: 0, cost: 0 };
}

export function getTodayStats(): WeeklyStat {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return (getDb()
    .prepare(`
      SELECT COUNT(DISTINCT session_id) AS sessions,
             COUNT(id)                  AS inputs,
             COALESCE(SUM(tokens_used), 0) AS tokens,
             COALESCE(SUM(time_ms), 0)     AS timeMs,
             COALESCE(SUM(cost_usd), 0)    AS cost
      FROM user_inputs WHERE started_at >= ? AND ended_at IS NOT NULL
    `)
    .get(startOfDay) as WeeklyStat) ?? { sessions: 0, inputs: 0, tokens: 0, timeMs: 0, cost: 0 };
}

export function getTopToolsByInputs(sinceTs = 0, limit = 10): ToolStat[] {
  const rows = getDb()
    .prepare("SELECT tools FROM user_inputs WHERE started_at > ? AND ended_at IS NOT NULL AND tools != '{}'")
    .all(sinceTs) as { tools: string }[];

  const totals = new Map<string, number>();
  for (const { tools } of rows) {
    try {
      for (const [k, v] of Object.entries(JSON.parse(tools) as Record<string, number>)) {
        totals.set(k, (totals.get(k) ?? 0) + v);
      }
    } catch { /* skip */ }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tool, total]) => ({ tool, total }));
}

export function getTopModelsByInputs(limit = 6): ModelStat[] {
  return getDb()
    .prepare(`
      SELECT provider, model_id, COUNT(*) AS uses
      FROM user_inputs WHERE ended_at IS NOT NULL
      GROUP BY provider, model_id ORDER BY uses DESC LIMIT ?
    `)
    .all(limit) as ModelStat[];
}

export function getModelEfficiency(): ModelEfficiency[] {
  return getDb()
    .prepare(`
      SELECT provider, model_id,
             COUNT(*) AS inputs,
             COALESCE(ROUND(AVG(tokens_used)), 0)                                AS avgTokens,
             COALESCE(ROUND(AVG(time_ms) / 1000.0, 1), 0)                       AS avgTimeSec,
             CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(cost_usd)/COUNT(*), 4) ELSE 0 END AS costPerInput,
             COALESCE(ROUND(SUM(cost_usd), 2), 0)                               AS totalCost
      FROM user_inputs WHERE ended_at IS NOT NULL AND time_ms > 0
      GROUP BY provider, model_id ORDER BY inputs DESC
    `)
    .all() as ModelEfficiency[];
}

export function getTopProjects(limit = 8): ProjectStat[] {
  const rows = getDb()
    .prepare(`
      SELECT s.cwd, COUNT(ui.id) AS inputs
      FROM user_inputs ui JOIN sessions s ON ui.session_id = s.id
      WHERE ui.ended_at IS NOT NULL
      GROUP BY s.cwd ORDER BY inputs DESC LIMIT ?
    `)
    .all(limit) as Array<{ cwd: string | null; inputs: number }>;
  return rows.map(r => ({
    project: r.cwd?.split("/").pop() ?? r.cwd ?? "—",
    inputs: r.inputs,
  }));
}

export function getDailyStats(days = 30): DailyStat[] {
  const since = Date.now() - days * 86_400_000;
  return getDb()
    .prepare(`
      SELECT date(started_at/1000, 'unixepoch', 'localtime') AS day,
             COALESCE(SUM(tokens_used), 0) AS tokens,
             COUNT(DISTINCT session_id)    AS sessions,
             COUNT(*)                      AS inputs
      FROM user_inputs WHERE started_at > ? AND ended_at IS NOT NULL
      GROUP BY day ORDER BY day
    `)
    .all(since) as DailyStat[];
}

export function getDailyCosts(days = 30): DailyCost[] {
  const since = Date.now() - days * 86_400_000;
  return getDb()
    .prepare(`
      SELECT date(started_at/1000, 'unixepoch', 'localtime') AS day,
             COALESCE(SUM(cost_usd), 0) AS cost
      FROM user_inputs WHERE started_at > ? AND ended_at IS NOT NULL
      GROUP BY day ORDER BY day
    `)
    .all(since) as DailyCost[];
}

export function getRecentSessions(limit = 6): RecentSession[] {
  return getDb()
    .prepare(`
      SELECT s.id, s.started_at, s.duration, s.turns, s.tokens, s.cost, s.cwd,
             COUNT(ui.id) AS inputs
      FROM sessions s
      LEFT JOIN user_inputs ui ON ui.session_id = s.id AND ui.ended_at IS NOT NULL
      WHERE s.ended_at IS NOT NULL AND s.turns > 0
      GROUP BY s.id ORDER BY s.started_at DESC LIMIT ?
    `)
    .all(limit) as RecentSession[];
}

export function getToollessInputCount(sinceTs = 0): { total: number; toolless: number } {
  return getDb()
    .prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(CASE WHEN tools='{}' THEN 1 ELSE 0 END), 0) AS toolless
      FROM user_inputs WHERE started_at > ? AND ended_at IS NOT NULL
    `)
    .get(sinceTs) as { total: number; toolless: number };
}

export function getStreak(): number {
  const rows = getDb()
    .prepare(`
      SELECT DISTINCT date(started_at/1000, 'unixepoch', 'localtime') AS day
      FROM user_inputs WHERE ended_at IS NOT NULL ORDER BY day DESC
    `)
    .all() as Array<{ day: string }>;

  if (!rows.length) return 0;

  const today = new Date();
  const todayStr = localDateStr(today);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = localDateStr(yest);
  const lastDay = rows[0]!.day;

  let offset: number;
  if (lastDay === todayStr) offset = 0;
  else if (lastDay === yesterdayStr) offset = 1;
  else return 0;

  let streak = 0;
  for (let i = 0; i < rows.length; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i - offset);
    if (rows[i]!.day === localDateStr(d)) streak++;
    else break;
  }
  return streak;
}

export function getDurationHistogram(): DurationBucket[] {
  const rows = getDb()
    .prepare(`
      SELECT CASE
        WHEN time_ms < 10000  THEN '<10s'
        WHEN time_ms < 30000  THEN '10-30s'
        WHEN time_ms < 60000  THEN '30s-1m'
        WHEN time_ms < 300000 THEN '1-5m'
        ELSE '5m+'
      END AS label, COUNT(*) AS count
      FROM user_inputs WHERE ended_at IS NOT NULL AND time_ms > 0
      GROUP BY label
    `)
    .all() as Array<{ label: string; count: number }>;

  const order = ["<10s", "10-30s", "30s-1m", "1-5m", "5m+"];
  const map = new Map(rows.map(r => [r.label, r.count]));
  return order.map(label => ({ label, count: map.get(label) ?? 0 }));
}

export function getTokenWaste(minTokens = 5000, limit = 5): TokenWasteEntry[] {
  return getDb()
    .prepare(`
      SELECT id, tokens_used, time_ms, provider, model_id, started_at
      FROM user_inputs
      WHERE ended_at IS NOT NULL AND tools='{}' AND tokens_used >= ?
      ORDER BY tokens_used DESC LIMIT ?
    `)
    .all(minTokens, limit) as TokenWasteEntry[];
}

export function getTokenBreakdown(sinceTs = 0): TokenBreakdown {
  const row = getDb()
    .prepare(`
      SELECT COALESCE(SUM(tokens_input), 0)       AS input,
             COALESCE(SUM(tokens_output), 0)      AS output,
             COALESCE(SUM(tokens_cache_read), 0)  AS cacheRead,
             COALESCE(SUM(tokens_cache_write), 0) AS cacheWrite
      FROM user_inputs WHERE started_at >= ? AND ended_at IS NOT NULL
    `)
    .get(sinceTs) as TokenBreakdown | undefined;
  return row ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

export function getCacheRatio(): CacheRatio {
  const row = getDb()
    .prepare(`
      SELECT COALESCE(SUM(tokens_cache_read), 0) AS cacheRead,
             COALESCE(SUM(tokens_input), 0)       AS totalInput
      FROM user_inputs WHERE ended_at IS NOT NULL
    `)
    .get() as { cacheRead: number; totalInput: number } | undefined;
  const cr = Number(row?.cacheRead ?? 0);
  const ti = Number(row?.totalInput ?? 0);
  return { cacheRead: cr, totalInput: ti, ratio: ti > 0 ? cr / ti : 0 };
}

export function getCompactions(limit = 10): CompactionRecord[] {
  return getDb()
    .prepare(`
      SELECT id, session_id AS sessionId, compacted_at AS compactedAt,
             tokens_before AS tokensBefore, tokens_after AS tokensAfter,
             tokens_saved AS tokensSaved
      FROM compactions ORDER BY compacted_at DESC LIMIT ?
    `)
    .all(limit) as CompactionRecord[];
}

export function getCompactionSummary(): { total: number; tokensSaved: number } {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total, COALESCE(SUM(tokens_saved), 0) AS tokensSaved FROM compactions")
    .get() as { total: number; tokensSaved: number } | undefined;
  return { total: Number(row?.total ?? 0), tokensSaved: Number(row?.tokensSaved ?? 0) };
}

export function getRecentErrors(limit = 10): ErrorRecord[] {
  return getDb()
    .prepare(`
      SELECT id, session_id AS sessionId, occurred_at AS occurredAt,
             error_type AS errorType, model_id AS modelId, message
      FROM errors ORDER BY occurred_at DESC LIMIT ?
    `)
    .all(limit) as ErrorRecord[];
}

export function getErrorSummary(): { total: number; today: number } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const row = getDb()
    .prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(CASE WHEN occurred_at >= ? THEN 1 ELSE 0 END), 0) AS today
      FROM errors
    `)
    .get(startOfDay) as { total: number; today: number } | undefined;
  return { total: Number(row?.total ?? 0), today: Number(row?.today ?? 0) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
