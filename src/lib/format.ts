/**
 * Formatting utilities for financial display values.
 */
import type { AssetClass } from "./types";

/** Format a number as USD currency. */
export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: abs >= 1000 ? 0 : 2,
    maximumFractionDigits: abs >= 1000 ? 0 : 2,
  }).format(abs);
  return value < 0 ? `-${formatted}` : formatted;
}

/** Format a number as a compact currency (e.g. $1.2M, $450K). */
export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${value < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${value < 0 ? "-" : ""}$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  }
  return formatCurrency(value);
}

/** Format a number as a percentage. */
export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Format a date string to a readable format. */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Quantity display. Crypto or sub-unit holdings get up to 6 decimals;
 * everything else rounds to 2. Whole shares render as `100`, not `100.00`.
 */
export function formatQuantity(
  value: number | null | undefined,
  assetClass?: AssetClass
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const maxDp = assetClass === "crypto" || Math.abs(value) < 1 ? 6 : 2;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxDp,
    minimumFractionDigits: 0,
  });
}

/** "3h ago" / "2d ago" / "just now". One place for relative-time copy. */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Capitalize and prettify a snake_case or camelCase string. */
export function prettifyLabel(str: string): string {
  return str
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
