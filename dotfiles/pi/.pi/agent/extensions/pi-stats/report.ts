import type { DatabaseSync } from "node:sqlite";

type Totals = { runs: number; sessions: number; cost: number; tokens: number; cache: number; errors: number };
type Row = Record<string, string | number>;

const DAY = 86_400_000;
const TOTALS = `
  SELECT COUNT(*) AS runs, COUNT(DISTINCT session_id) AS sessions,
         COALESCE(SUM(cost), 0) AS cost,
         COALESCE(SUM(input + output + cache_read + cache_write), 0) AS tokens,
         COALESCE(SUM(cache_read) * 1.0 / NULLIF(SUM(input + cache_read + cache_write), 0), 0) AS cache,
         COUNT(error) AS errors
  FROM runs WHERE started_at >= ?`;

export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function totals(db: DatabaseSync, since: number): Totals {
  return db.prepare(TOTALS).get(since) as Totals;
}

export const money = (n: number) => `$${n.toFixed(2)}`;
export const tokens = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`;

function streak(db: DatabaseSync): number {
  const days = new Set(
    (db.prepare("SELECT DISTINCT date(started_at / 1000, 'unixepoch', 'localtime') AS d FROM runs").all() as Row[]).map((r) => r.d),
  );
  const d = new Date();
  const key = () => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (!days.has(key())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(key())) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function table(title: string, head: string[], rows: unknown[][]): string {
  const th = head.map((h) => `<th>${h}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<section><h2>${title}</h2><table><tr>${th}</tr>${tr}</table></section>`;
}

export function buildHtml(db: DatabaseSync): string {
  const now = Date.now();
  const cards = (
    [
      ["Today", startOfToday()],
      ["7 days", now - 7 * DAY],
      ["30 days", now - 30 * DAY],
      ["All time", 0],
    ] as const
  )
    .map(([label, since]) => {
      const t = totals(db, since);
      return `<div class="card"><h3>${label}</h3><b>${money(t.cost)}</b>
        <span>${t.runs} prompts · ${t.sessions} sessions</span>
        <span>${tokens(t.tokens)} tok · ${(t.cache * 100).toFixed(0)}% cached · ${t.errors} errors</span></div>`;
    })
    .join("");

  const daily = db.prepare(`
    SELECT date(started_at / 1000, 'unixepoch', 'localtime') AS day, SUM(cost) AS cost, COUNT(*) AS runs
    FROM runs WHERE started_at >= ? GROUP BY day ORDER BY day`).all(now - 30 * DAY) as Row[];
  const max = Math.max(0.01, ...daily.map((d) => Number(d.cost)));
  const bars = daily
    .map((d) => `<div class="bar" style="height:${(Number(d.cost) / max) * 100}%" title="${d.day}: ${money(Number(d.cost))} · ${d.runs} prompts"></div>`)
    .join("");

  const models = db.prepare(`
    SELECT model, COUNT(*) AS runs, SUM(cost) AS cost, AVG(cost) AS avg, AVG(ended_at - started_at) AS ms
    FROM runs GROUP BY model ORDER BY cost DESC LIMIT 10`).all() as Row[];
  const projects = db.prepare(`
    SELECT cwd, COUNT(*) AS runs, SUM(cost) AS cost FROM runs GROUP BY cwd ORDER BY cost DESC LIMIT 10`).all() as Row[];

  const tools = (db.prepare(`
    SELECT j.key AS tool, SUM(j.value) AS calls FROM runs, json_each(runs.tools) j
    WHERE started_at >= ? AND json_valid(runs.tools) GROUP BY j.key ORDER BY calls DESC LIMIT 12`).all(now - 30 * DAY) as Row[])
    .map((t) => [t.tool, t.calls]);

  const comp = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(cost), 0) AS cost FROM compactions").get() as Row;
  const errors = db.prepare(`
    SELECT started_at, model, error FROM runs WHERE error IS NOT NULL ORDER BY started_at DESC LIMIT 8`).all() as Row[];

  return `<!doctype html><meta charset="utf-8"><title>pi stats</title>
<style>
  body{font:14px/1.5 ui-monospace,Menlo,monospace;background:#1d2021;color:#d4be98;max-width:1100px;margin:2rem auto;padding:0 1rem}
  h1{color:#d8a657}h2{color:#a9b665;font-size:1rem;margin-top:2rem}h3{margin:0;color:#928374;font-weight:normal}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
  .card{background:#282828;padding:1rem;border-radius:8px;display:flex;flex-direction:column}
  .card b{font-size:1.8rem;color:#e78a4e}.card span{color:#928374;font-size:12px}
  .chart{display:flex;align-items:flex-end;gap:3px;height:140px;background:#282828;padding:1rem;border-radius:8px}
  .bar{flex:1;background:#7daea3;min-height:2px;border-radius:2px 2px 0 0}.bar:hover{background:#d8a657}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:0 2rem}
  table{width:100%;border-collapse:collapse}td,th{padding:4px 8px;text-align:left;border-bottom:1px solid #32302f}
  th{color:#928374;font-weight:normal}
</style>
<h1>π stats</h1>
<p style="color:#928374">${new Date().toLocaleString()} · 🔥 ${streak(db)} day streak · ${comp.n} compactions (${money(Number(comp.cost))})</p>
<div class="cards">${cards}</div>
<h2>Daily cost · 30 days</h2><div class="chart">${bars}</div>
<div class="grid">
${table("Models", ["model", "prompts", "cost", "$/prompt", "avg time"], models.map((m) => [m.model || "—", m.runs, money(Number(m.cost)), money(Number(m.avg)), `${(Number(m.ms) / 1000).toFixed(0)}s`]))}
${table("Projects", ["project", "prompts", "cost"], projects.map((p) => [String(p.cwd).split("/").pop() || "—", p.runs, money(Number(p.cost))]))}
${table("Tools · 30 days", ["tool", "calls"], tools)}
${table("Recent errors", ["when", "model", "error"], errors.map((e) => [new Date(Number(e.started_at)).toLocaleString(), e.model, e.error]))}
</div>`;
}
