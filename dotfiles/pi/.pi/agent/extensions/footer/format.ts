import { truncateToWidth } from "@earendil-works/pi-tui";

const COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const fmt = (n: number) => COMPACT.format(n);

export function fmtIdle(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function fmtCost(n: number): string {
  if (n <= 0) return "$0";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
}

export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

export function buildLine(left: string, right: string, width: number): string {
  if (!right) return truncateToWidth(left, width);
  const pad = Math.max(
    1,
    width - 4 - stripAnsi(left).length - stripAnsi(right).length,
  );
  return truncateToWidth(left + " ".repeat(pad) + right, width);
}
