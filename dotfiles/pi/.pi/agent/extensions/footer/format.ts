import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const fmt = (n: number) => COMPACT.format(n);

export function fmtCost(n: number): string {
  if (n <= 0) return "$0";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
}

/**
 * Justify `left` and `right` across `width`, truncating if too long.
 * Uses visibleWidth (display-column aware — handles nerd-font glyphs and
 * wide chars correctly) instead of raw string length.
 */
export function buildLine(left: string, right: string, width: number): string {
  if (!right) return truncateToWidth(left, width);
  const pad = Math.max(1, width - 4 - visibleWidth(left) - visibleWidth(right));
  return truncateToWidth(left + " ".repeat(pad) + right, width);
}
