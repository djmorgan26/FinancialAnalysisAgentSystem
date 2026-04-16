"use client";

import type { Holding } from "@/lib/types";
import { formatCurrency, formatPercent, prettifyLabel } from "@/lib/format";
import { useState } from "react";

interface TopHoldingsProps {
  holdings: Holding[];
}

const platformColors: Record<string, string> = {
  fidelity: "#4ade80",
  schwab: "#60a5fa",
  robinhood: "#a78bfa",
};

interface ConsolidatedHolding {
  symbol: string;
  name: string;
  totalShares: number;
  totalValue: number;
  totalCost: number;
  gain: number;
  gainPct: number;
  platforms: string[];
  sector: string;
}

export default function TopHoldings({ holdings }: TopHoldingsProps) {
  const [showAll, setShowAll] = useState(false);

  // Consolidate by symbol
  const consolidated = new Map<string, ConsolidatedHolding>();
  for (const h of holdings) {
    const existing = consolidated.get(h.symbol);
    if (existing) {
      existing.totalShares += h.quantity;
      existing.totalValue += h.currentValue;
      existing.totalCost += h.costBasis;
      existing.gain += h.gainLoss;
      if (!existing.platforms.includes(h.platform)) {
        existing.platforms.push(h.platform);
      }
    } else {
      consolidated.set(h.symbol, {
        symbol: h.symbol,
        name: h.name,
        totalShares: h.quantity,
        totalValue: h.currentValue,
        totalCost: h.costBasis,
        gain: h.gainLoss,
        gainPct: 0,
        platforms: [h.platform],
        sector: h.sector,
      });
    }
  }

  const sorted = Array.from(consolidated.values())
    .map((h) => ({
      ...h,
      gainPct: h.totalCost > 0 ? (h.gain / h.totalCost) * 100 : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  const totalPortfolio = sorted.reduce((sum, h) => sum + h.totalValue, 0);
  const displayed = showAll ? sorted : sorted.slice(0, 15);

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Top Holdings
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (consolidated across platforms)
          </span>
        </h2>
        <span className="text-sm text-muted-foreground">
          {consolidated.size} unique positions
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-left">
              <th className="pb-2 font-medium text-muted-foreground">Symbol</th>
              <th className="pb-2 font-medium text-muted-foreground hidden sm:table-cell">
                Name
              </th>
              <th className="pb-2 font-medium text-muted-foreground text-right">
                Shares
              </th>
              <th className="pb-2 font-medium text-muted-foreground text-right">
                Value
              </th>
              <th className="pb-2 font-medium text-muted-foreground text-right">
                % Port
              </th>
              <th className="pb-2 font-medium text-muted-foreground text-right">
                Gain/Loss
              </th>
              <th className="pb-2 font-medium text-muted-foreground text-right hidden md:table-cell">
                Return
              </th>
              <th className="pb-2 font-medium text-muted-foreground text-right">
                Platforms
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((h) => {
              const pctPort = (h.totalValue / totalPortfolio) * 100;
              const isPositive = h.gain >= 0;
              return (
                <tr
                  key={h.symbol}
                  className="border-b border-card-border/50 hover:bg-card-hover transition-colors"
                >
                  <td className="py-2.5 font-mono font-semibold text-foreground">
                    {h.symbol}
                  </td>
                  <td className="py-2.5 text-muted-foreground truncate max-w-[200px] hidden sm:table-cell">
                    {h.name}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-foreground">
                    {h.totalShares < 1
                      ? h.totalShares.toFixed(4)
                      : h.totalShares < 100
                      ? h.totalShares.toFixed(3)
                      : h.totalShares.toFixed(1)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-foreground">
                    {formatCurrency(h.totalValue)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                    {pctPort.toFixed(1)}%
                  </td>
                  <td
                    className={`py-2.5 text-right tabular-nums font-medium ${
                      isPositive ? "text-positive" : "text-negative"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {formatCurrency(h.gain)}
                  </td>
                  <td
                    className={`py-2.5 text-right tabular-nums hidden md:table-cell ${
                      isPositive ? "text-positive" : "text-negative"
                    }`}
                  >
                    {formatPercent(h.gainPct)}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {h.platforms.map((p) => (
                        <span
                          key={p}
                          className="inline-block w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: platformColors[p] ?? "#737373",
                          }}
                          title={prettifyLabel(p)}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > 15 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-sm text-accent hover:text-foreground transition-colors"
        >
          {showAll
            ? "Show top 15"
            : `Show all ${sorted.length} positions`}
        </button>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#4ade80" }}
          />
          Fidelity
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#60a5fa" }}
          />
          Schwab
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#a78bfa" }}
          />
          Robinhood
        </span>
      </div>
    </section>
  );
}
