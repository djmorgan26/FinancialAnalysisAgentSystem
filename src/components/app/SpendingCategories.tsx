import type { SpendingBreakdown } from "@/lib/types";
import { formatCurrency, prettifyLabel } from "@/lib/format";
import { categoryColors } from "./chartColors";

interface Props {
  data: SpendingBreakdown[];
  max?: number;
}

export function SpendingCategories({ data, max = 6 }: Props) {
  const rows = [...data]
    .filter((r) => r.monthlyAverage > 0)
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)
    .slice(0, max);

  if (rows.length === 0) {
    return (
      <div className="text-[12px] text-[color:var(--text-muted)]">
        No spending data yet — import transactions to see category breakdown.
      </div>
    );
  }

  const peak = Math.max(...rows.map((r) => r.monthlyAverage), 1);

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const color = categoryColors[r.category] ?? categoryColors.other;
        return (
          <div key={r.category}>
            <div className="flex items-baseline justify-between text-[11.5px] mb-1">
              <span
                className="capitalize"
                style={{ color: "var(--text-muted)" }}
              >
                {prettifyLabel(r.category)}
                {r.trend === "increasing" && (
                  <span
                    className="ml-1.5 text-[10px]"
                    style={{ color: "var(--loss)" }}
                    title="Trending up"
                  >
                    ↑
                  </span>
                )}
                {r.trend === "decreasing" && (
                  <span
                    className="ml-1.5 text-[10px]"
                    style={{ color: "var(--gain)" }}
                    title="Trending down"
                  >
                    ↓
                  </span>
                )}
              </span>
              <span className="mono">
                {formatCurrency(r.monthlyAverage)}
                <span
                  className="ml-2 font-normal"
                  style={{ color: "var(--text-faint)" }}
                >
                  {r.percentOfTotal.toFixed(0)}%
                </span>
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--bg-inset)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(r.monthlyAverage / peak) * 100}%`,
                  background: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
