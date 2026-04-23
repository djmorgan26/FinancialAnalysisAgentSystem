import type { Holding, Platform } from "@/lib/types";
import { Card } from "./Pill";
import { formatCurrency, formatQuantity } from "@/lib/format";

interface Props {
  holdings: Holding[];
}

interface OverlapRow {
  symbol: string;
  name: string;
  totalValue: number;
  totalQuantity: number;
  byPlatform: { platform: Platform; value: number; quantity: number }[];
}

const platformTone: Record<Platform, string> = {
  fidelity: "#4ade80",
  schwab: "#60a5fa",
  robinhood: "#a78bfa",
  coinbase: "#fb923c",
  chase: "#22d3ee",
  citi: "#f472b6",
  manual: "#94a3b8",
};

export function PlatformOverlap({ holdings }: Props) {
  const bySymbol = new Map<string, OverlapRow>();
  for (const h of holdings) {
    if (!h.symbol || h.assetClass === "cash") continue;
    const key = h.symbol.toUpperCase();
    const prev = bySymbol.get(key);
    if (prev) {
      prev.totalValue += h.currentValue;
      prev.totalQuantity += h.quantity;
      const existing = prev.byPlatform.find((p) => p.platform === h.platform);
      if (existing) {
        existing.value += h.currentValue;
        existing.quantity += h.quantity;
      } else {
        prev.byPlatform.push({
          platform: h.platform,
          value: h.currentValue,
          quantity: h.quantity,
        });
      }
    } else {
      bySymbol.set(key, {
        symbol: key,
        name: h.name,
        totalValue: h.currentValue,
        totalQuantity: h.quantity,
        byPlatform: [
          { platform: h.platform, value: h.currentValue, quantity: h.quantity },
        ],
      });
    }
  }

  const overlaps = [...bySymbol.values()]
    .filter((r) => r.byPlatform.length > 1)
    .sort((a, b) => b.totalValue - a.totalValue);

  if (overlaps.length === 0) return null;

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold">Cross-platform holdings</h3>
        <div className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
          Symbols you hold on more than one brokerage — consolidate to simplify
          or keep separated for tax lot flexibility.
        </div>
      </div>
      <div className="space-y-3">
        {overlaps.map((row) => (
          <div
            key={row.symbol}
            className="pb-3 last:pb-0"
            style={{
              borderBottom:
                overlaps.length > 1 ? "1px dotted var(--border)" : "none",
            }}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="flex items-baseline gap-2">
                <span className="mono font-semibold text-[13px]">
                  {row.symbol}
                </span>
                <span
                  className="text-[11.5px] truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {row.name || "—"}
                </span>
              </div>
              <div className="mono text-[13px] font-medium">
                {formatCurrency(row.totalValue)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {row.byPlatform.map((p) => (
                <span
                  key={p.platform}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]"
                  style={{
                    background: "var(--bg-inset)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: platformTone[p.platform] }}
                  />
                  <span
                    className="capitalize"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {p.platform}
                  </span>
                  <span className="mono" style={{ color: "var(--text)" }}>
                    {formatCurrency(p.value)}
                  </span>
                  <span
                    className="mono"
                    style={{ color: "var(--text-faint)" }}
                  >
                    ({formatQuantity(p.quantity)})
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
