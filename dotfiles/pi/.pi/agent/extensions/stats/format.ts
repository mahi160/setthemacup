/** Shared formatters used by both TUI render and HTML dashboard.
 *  All functions are null/NaN-safe — they coerce input to a safe number. */

function safe(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmtTokens(n: number): string {
  const v = safe(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${v}`;
}

export function fmtCost(usd: number): string {
  const v = safe(usd);
  if (v <= 0) return "$0.00";
  if (v < 0.005) return "<$0.01";
  return `$${v.toFixed(2)}`;
}

export function fmtMs(ms: number): string {
  const v = safe(ms);
  if (!v) return "—";
  const s = Math.floor(v / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function fmtDate(ts: number): string {
  return new Date(safe(ts)).toISOString().slice(0, 10);
}

export function fmtDateShort(ts: number): string {
  const d = new Date(safe(ts));
  return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
}

/** Format a date in local YYYY-MM-DD (matches SQLite localtime). */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
