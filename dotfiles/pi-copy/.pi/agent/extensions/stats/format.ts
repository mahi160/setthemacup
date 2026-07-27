/** Shared formatters — null/NaN-safe, used by both TUI and HTML dashboard. */

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
  const d = new Date(safe(ts));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtPct(ratio: number): string {
  return `${Math.round(safe(ratio) * 100)}%`;
}

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
