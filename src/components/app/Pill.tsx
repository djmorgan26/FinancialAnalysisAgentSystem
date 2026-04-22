import type { ReactNode } from "react";

export function Delta({
  value,
  pct,
  suffix,
  size = 13,
}: {
  value?: number;
  pct?: number;
  suffix?: string;
  size?: number;
}) {
  const v = value ?? 0;
  const up = v > 0;
  const down = v < 0;
  const arrow = up ? "▲" : down ? "▼" : "◆";
  const color = up ? "var(--gain)" : down ? "var(--loss)" : "var(--text-muted)";
  const abs = Math.abs(v);
  const pctAbs = pct != null ? Math.abs(pct).toFixed(2) : null;

  return (
    <span className="mono" style={{ color, fontSize: size, fontWeight: 600 }}>
      {arrow} {up ? "+" : down ? "−" : ""}${abs.toLocaleString()}
      {pctAbs != null && ` (${up ? "+" : down ? "−" : ""}${pctAbs}%)`}
      {suffix && (
        <span
          className="ml-2 font-normal"
          style={{ color: "var(--text-faint)" }}
        >
          {suffix}
        </span>
      )}
    </span>
  );
}

export function StatusBadge({
  state,
}: {
  state: "connected" | "csv-fresh" | "csv-stale" | "error" | "not-set-up" | "coming-soon";
}) {
  const cfg: Record<
    string,
    { label: string; tone: string; icon: string }
  > = {
    connected: { label: "Connected", tone: "gain", icon: "●" },
    "csv-fresh": { label: "CSV — current", tone: "info", icon: "↓" },
    "csv-stale": { label: "CSV — refresh needed", tone: "warn", icon: "⚠" },
    error: { label: "Needs attention", tone: "loss", icon: "⚠" },
    "not-set-up": { label: "Not set up", tone: "muted", icon: "○" },
    "coming-soon": { label: "Coming soon", tone: "muted", icon: "⏳" },
  };
  const c = cfg[state];
  return (
    <span className={`chip chip-${c.tone}`}>
      <span>{c.icon}</span>
      {c.label}
    </span>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
  style,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`card ${padded ? "p-5" : ""} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
