"use client";

import type { Holding } from "@/lib/types";
import { formatCurrency, prettifyLabel } from "@/lib/format";

interface PlatformOverlapProps {
  holdings: Holding[];
}

const platformColors: Record<string, string> = {
  fidelity: "#4ade80",
  schwab: "#60a5fa",
  robinhood: "#a78bfa",
};

export default function PlatformOverlap({ holdings }: PlatformOverlapProps) {
  // Find symbols held on multiple platforms
  const symbolPlatforms = new Map<
    string,
    { platforms: Set<string>; totalValue: number; totalShares: number; name: string }
  >();

  for (const h of holdings) {
    const existing = symbolPlatforms.get(h.symbol);
    if (existing) {
      existing.platforms.add(h.platform);
      existing.totalValue += h.currentValue;
      existing.totalShares += h.quantity;
    } else {
      symbolPlatforms.set(h.symbol, {
        platforms: new Set([h.platform]),
        totalValue: h.currentValue,
        totalShares: h.quantity,
        name: h.name,
      });
    }
  }

  const overlapping = Array.from(symbolPlatforms.entries())
    .filter(([, data]) => data.platforms.size > 1)
    .sort((a, b) => b[1].totalValue - a[1].totalValue);

  if (overlapping.length === 0) return null;

  const totalOverlapValue = overlapping.reduce(
    (sum, [, data]) => sum + data.totalValue,
    0
  );

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <h2 className="text-lg font-semibold mb-1 text-foreground">
        Cross-Platform Overlap
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {overlapping.length} positions held on multiple brokerages
        <span className="ml-1 text-muted">
          ({formatCurrency(totalOverlapValue)} combined)
        </span>
      </p>

      <div className="space-y-2">
        {overlapping.map(([symbol, data]) => {
          const platforms = Array.from(data.platforms).sort();
          return (
            <div
              key={symbol}
              className="flex items-center justify-between py-2 border-b border-card-border/50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold text-sm text-foreground w-12">
                  {symbol}
                </span>
                <div className="flex items-center gap-1">
                  {platforms.map((p) => (
                    <span
                      key={p}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${platformColors[p] ?? "#737373"}20`,
                        color: platformColors[p] ?? "#737373",
                      }}
                    >
                      {prettifyLabel(p)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {data.totalShares < 1
                    ? data.totalShares.toFixed(4)
                    : data.totalShares.toFixed(2)}{" "}
                  shares
                </span>
                <span className="text-sm tabular-nums font-medium text-foreground w-24 text-right">
                  {formatCurrency(data.totalValue)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-info-muted border border-info/20">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-info">Tip:</span> Consolidating
          overlapping positions to fewer platforms simplifies rebalancing and
          tax-loss harvesting.
        </p>
      </div>
    </section>
  );
}
