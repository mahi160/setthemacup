import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { localDateStr } from "./format.js";

/* ─── database setup ──────────────────────────────────────────────────────── */

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
      session_id  TEXT NOT NULL,
      tool        TEXT NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, tool)
    );

    CREATE TABLE IF NOT EXISTS session_commands (
      session_id  TEXT NOT NULL,
      command     TEXT NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, command)
    );

    CREATE TABLE IF NOT EXISTS session_skills (
      session_id  TEXT NOT NULL,
      skill       TEXT NOT NULL,
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

/* ─── types ───────────────────────────────────────────────────────────────── */

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

export interface ToolStat { tool: string; total: number }
export interface ModelStat { provider: string; model_id: string; uses: number }

export interface ModelEfficiency {
  provider: string;
  model_id: string;
  inputs: number;
  avgTokens: number;
  avgTimeSec: number;
  costPerInput: number;
  totalCost: number;
}

export interface DailyStat { day: string; tokens: number; sessions: number; inputs: number }
export interface ProjectStat { project: string; inputs: number }

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

export interface DurationBucket { label: string; count: number }

export interface TokenWasteEntry {
  id: string;
  tokens_used: number;
  time_ms: number;
  provider: string;
  model_id: string;
  started_at: number;
}

/* ─── writes ──────────────────────────────────────────────────────────────── */

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
    // Session cost = sum of per-input costs (accurate across model switches)
    const row = db.prepare(
      "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM user_inputs WHERE session_id=? AND ended_at IS NOT NULL",
    ).get(id) as { total: number } | undefined;
    const inputCost = row?.total ?? 0;

    db.prepare(
      "UPDATE sessions SET ended_at=?, duration=?-started_at, turns=?, tokens=?, cost=? WHERE id=?",
    ).run(endedAt, endedAt, turns, tokens, inputCost, id);

    const toolStmt = db.prepare("INSERT OR REPLACE INTO session_tools (session_id, tool, count) VALUES (?, ?, ?)");
    for (const [name, count] of tools) toolStmt.run(id, name, count);

    const cmdStmt = db.prepare("INSERT OR REPLACE INTO session_commands (session_id, command, count) VALUES (?, ?, ?)");
    for (const [name, count] of commands) cmdStmt.run(id, name, count);

    const skillStmt = db.prepare("INSERT OR REPLACE INTO session_skills (session_id, skill, count) VALUES (?, ?, ?)");
    for (const [name, count] of skills) skillStmt.run(id, name, count);

    const modelStmt = db.prepare("INSERT INTO session_models (session_id, provider, model_id, selected_at) VALUES (?, ?, ?, ?)");
    for (const m of models) modelStmt.run(id, m.provider, m.modelId, m.selectedAt);

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function createInputRecord(r: {
  id: string; sessionId: string; startedAt: number; provider: string; modelId: string;
}): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO user_inputs (id, session_id, started_at, provider, model_id) VALUES (?, ?, ?, ?, ?)")
    .run(r.id, r.sessionId, r.startedAt, r.provider, r.modelId);
}

export function finalizeInputRecord(
  id: string, endedAt: number, timeMs: number, tokensUsed: number,
  tools: Map<string, number>, commands: Map<string, number>, skills: Map<string, number>,
  costUsd: number,
): void {
  getDb()
    .prepare("UPDATE user_inputs SET ended_at=?, time_ms=?, tokens_used=?, tools=?, commands=?, skills=?, cost_usd=? WHERE id=?")
    .run(endedAt, timeMs, tokensUsed,
      JSON.stringify(Object.fromEntries(tools)),
      JSON.stringify(Object.fromEntries(commands)),
      JSON.stringify(Object.fromEntries(skills)),
      costUsd, id);
}

/* ─── queries ─────────────────────────────────────────────────────────────── */

export function getOverallStats(): OverallStats {
  return getDb().prepare(
    `SELECT COUNT(*) AS totalSessions, COALESCE(SUM(tokens),0) AS totalTokens,
            COALESCE(SUM(cost),0) AS totalCost, COALESCE(SUM(turns),0) AS totalTurns,
            (SELECT COUNT(*) FROM user_inputs WHERE ended_at IS NOT NULL) AS totalInputs
     FROM sessions WHERE ended_at IS NOT NULL AND turns > 0`,
  ).get() as OverallStats;
}

export function getWeeklyStats(startTs: number, endTs: number): WeeklyStat {
  return (getDb().prepare(
    `SELECT COUNT(DISTINCT session_id) AS sessions, COUNT(id) AS inputs,
            COALESCE(SUM(tokens_used),0) AS tokens, COALESCE(SUM(time_ms),0) AS timeMs,
            COALESCE(SUM(cost_usd),0) AS cost
     FROM user_inputs WHERE started_at>=? AND started_at<? AND ended_at IS NOT NULL`,
  ).get(startTs, endTs) as WeeklyStat) ?? { sessions: 0, inputs: 0, tokens: 0, timeMs: 0, cost: 0 };
}

export function getTodayStats(): WeeklyStat {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return (getDb().prepare(
    `SELECT COUNT(DISTINCT session_id) AS sessions, COUNT(id) AS inputs,
            COALESCE(SUM(tokens_used),0) AS tokens, COALESCE(SUM(time_ms),0) AS timeMs,
            COALESCE(SUM(cost_usd),0) AS cost
     FROM user_inputs WHERE started_at>=? AND ended_at IS NOT NULL`,
  ).get(startOfDay) as WeeklyStat) ?? { sessions: 0, inputs: 0, tokens: 0, timeMs: 0, cost: 0 };
}

export function getTopToolsByInputs(sinceTs = 0, limit = 10): ToolStat[] {
  return getDb().prepare(
    `SELECT je.key AS tool, SUM(CAST(je.value AS INTEGER)) AS total
     FROM user_inputs CROSS JOIN json_each(user_inputs.tools) AS je
     WHERE user_inputs.started_at>? AND user_inputs.ended_at IS NOT NULL
     GROUP BY je.key ORDER BY total DESC LIMIT ?`,
  ).all(sinceTs, limit) as ToolStat[];
}

export function getTopModelsByInputs(limit = 6): ModelStat[] {
  return getDb().prepare(
    `SELECT provider, model_id, COUNT(*) AS uses FROM user_inputs
     WHERE ended_at IS NOT NULL GROUP BY provider, model_id ORDER BY uses DESC LIMIT ?`,
  ).all(limit) as ModelStat[];
}

export function getModelEfficiency(): ModelEfficiency[] {
  return getDb().prepare(
    `SELECT provider, model_id, COUNT(*) AS inputs,
            COALESCE(ROUND(AVG(tokens_used)),0) AS avgTokens,
            COALESCE(ROUND(AVG(time_ms)/1000.0,1),0) AS avgTimeSec,
            CASE WHEN COUNT(*)>0 THEN ROUND(SUM(cost_usd)/COUNT(*),4) ELSE 0 END AS costPerInput,
            COALESCE(ROUND(SUM(cost_usd),2),0) AS totalCost
     FROM user_inputs WHERE ended_at IS NOT NULL AND time_ms>0
     GROUP BY provider, model_id ORDER BY inputs DESC`,
  ).all() as ModelEfficiency[];
}

export function getTopProjects(limit = 8): ProjectStat[] {
  const rows = getDb().prepare(
    `SELECT s.cwd, COUNT(ui.id) AS inputs FROM user_inputs ui
     JOIN sessions s ON ui.session_id=s.id WHERE ui.ended_at IS NOT NULL
     GROUP BY s.cwd ORDER BY inputs DESC LIMIT ?`,
  ).all(limit) as Array<{ cwd: string | null; inputs: number }>;
  return rows.map(r => ({ project: r.cwd?.split("/").pop() ?? r.cwd ?? "—", inputs: r.inputs }));
}

export function getDailyStats(days = 30): DailyStat[] {
  const since = Date.now() - days * 86_400_000;
  return getDb().prepare(
    `SELECT date(started_at/1000,'unixepoch','localtime') AS day,
            COALESCE(SUM(tokens_used),0) AS tokens,
            COUNT(DISTINCT session_id) AS sessions, COUNT(*) AS inputs
     FROM user_inputs WHERE started_at>? AND ended_at IS NOT NULL
     GROUP BY day ORDER BY day`,
  ).all(since) as DailyStat[];
}

export function getRecentSessions(limit = 6): RecentSession[] {
  return getDb().prepare(
    `SELECT s.id, s.started_at, s.duration, s.turns, s.tokens, s.cost, s.cwd,
            COUNT(ui.id) AS inputs
     FROM sessions s LEFT JOIN user_inputs ui ON ui.session_id=s.id AND ui.ended_at IS NOT NULL
     WHERE s.ended_at IS NOT NULL AND s.turns>0
     GROUP BY s.id ORDER BY s.started_at DESC LIMIT ?`,
  ).all(limit) as RecentSession[];
}

// BUG FIX: COALESCE on SUM to handle null when 0 rows match
export function getToollessInputCount(sinceTs = 0): { total: number; toolless: number } {
  return getDb().prepare(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN tools='{}' THEN 1 ELSE 0 END), 0) AS toolless
     FROM user_inputs WHERE started_at>? AND ended_at IS NOT NULL`,
  ).get(sinceTs) as { total: number; toolless: number };
}

// BUG FIX: use localDateStr for consistent local timezone comparison
export function getStreak(): number {
  const rows = getDb().prepare(
    `SELECT DISTINCT date(started_at/1000,'unixepoch','localtime') AS day
     FROM user_inputs WHERE ended_at IS NOT NULL ORDER BY day DESC`,
  ).all() as Array<{ day: string }>;
  if (!rows.length) return 0;

  const today = new Date();
  const todayStr = localDateStr(today);
  const lastDay = rows[0]!.day;

  // Allow today or yesterday as most recent day
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = localDateStr(yesterdayDate);

  let offset: number;
  if (lastDay === todayStr) offset = 0;
  else if (lastDay === yesterdayStr) offset = 1;
  else return 0; // streak broken

  let streak = 0;
  for (let i = 0; i < rows.length; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i - offset);
    if (rows[i]!.day === localDateStr(d)) streak++;
    else break;
  }
  return streak;
}

// BUG FIX: do bucketing in SQL instead of fetching all rows to JS
export function getDurationHistogram(): DurationBucket[] {
  const rows = getDb().prepare(
    `SELECT
       CASE
         WHEN time_ms < 10000  THEN '<10s'
         WHEN time_ms < 30000  THEN '10-30s'
         WHEN time_ms < 60000  THEN '30s-1m'
         WHEN time_ms < 300000 THEN '1-5m'
         ELSE '5m+'
       END AS label,
       COUNT(*) AS count
     FROM user_inputs WHERE ended_at IS NOT NULL AND time_ms>0
     GROUP BY label`,
  ).all() as Array<{ label: string; count: number }>;

  // Ensure all buckets exist in order
  const order = ["<10s", "10-30s", "30s-1m", "1-5m", "5m+"];
  const map = new Map(rows.map(r => [r.label, r.count]));
  return order.map(label => ({ label, count: map.get(label) ?? 0 }));
}

export function getTokenWaste(minTokens = 5000, limit = 5): TokenWasteEntry[] {
  return getDb().prepare(
    `SELECT id, tokens_used, time_ms, provider, model_id, started_at
     FROM user_inputs WHERE ended_at IS NOT NULL AND tools='{}' AND tokens_used>=?
     ORDER BY tokens_used DESC LIMIT ?`,
  ).all(minTokens, limit) as TokenWasteEntry[];
}
