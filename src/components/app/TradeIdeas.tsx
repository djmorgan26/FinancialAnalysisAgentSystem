"use client";

import { useMemo, useState } from "react";
import { Card } from "./Pill";
import type { Holding, Sector } from "@/lib/types";
import { formatCurrency, formatPercent, prettifyLabel } from "@/lib/format";

interface Props {
  holdings: Holding[];
  sectorBias: Sector[];
  monthlyInvestmentBudget: number;
}

interface ETFSuggestion {
  symbol: string;
  name: string;
  why: string;
}

interface SectorGap {
  sector: Sector;
  currentPct: number;
  targetPct: number;
  gap: number;
  suggestions: ETFSuggestion[];
}

interface DipCandidate {
  symbol: string;
  name: string;
  currentValue: number;
  portfolioPct: number;
  gainLossPercent: number;
  sector: Sector;
  reason: string;
}

const sectorETFs: Partial<Record<Sector, ETFSuggestion[]>> = {
  healthcare: [
    { symbol: "XLV", name: "Health Care Select SPDR", why: "Large-cap healthcare — UNH, LLY, JNJ, ABBV." },
    { symbol: "VHT", name: "Vanguard Health Care ETF", why: "Broader healthcare, lower expense ratio than XLV." },
  ],
  biotech: [
    { symbol: "XBI", name: "SPDR S&P Biotech", why: "Equal-weighted biotech. Higher upside, more volatile." },
    { symbol: "IBB", name: "iShares Biotech", why: "Cap-weighted — heavier on Amgen, Gilead, Vertex." },
  ],
  financials: [
    { symbol: "XLF", name: "Financial Select SPDR", why: "Banks, insurance, fintech — diversifies from tech." },
    { symbol: "VFH", name: "Vanguard Financials", why: "Broader financials at lower cost." },
  ],
  energy: [
    { symbol: "XLE", name: "Energy Select SPDR", why: "Oil, gas, majors. Inflation hedge + income." },
    { symbol: "ICLN", name: "iShares Clean Energy", why: "Clean-energy tilt if you avoid fossil fuels." },
  ],
  consumer_staples: [
    { symbol: "XLP", name: "Consumer Staples SPDR", why: "Defensive — PG, COST, KO. Holds up in downturns." },
  ],
  consumer_discretionary: [
    { symbol: "XLY", name: "Consumer Discretionary SPDR", why: "AMZN, TSLA, HD. Cyclical growth." },
  ],
  industrials: [
    { symbol: "XLI", name: "Industrial Select SPDR", why: "Infrastructure, defense, manufacturing." },
  ],
  real_estate: [
    { symbol: "VNQ", name: "Vanguard Real Estate", why: "REITs for income + real-asset diversification." },
  ],
  semiconductors: [
    { symbol: "SMH", name: "VanEck Semiconductor", why: "Concentrated — NVDA, AVGO, TSM, AMD." },
    { symbol: "SOXX", name: "iShares Semiconductor", why: "Broader semi exposure, different weighting." },
  ],
  ai_ml: [
    { symbol: "BOTZ", name: "Global X Robotics & AI", why: "AI and robotics-focused, global." },
  ],
  quantum_computing: [
    { symbol: "QTUM", name: "Defiance Quantum ETF", why: "Quantum + ML-adjacent names." },
  ],
  utilities: [
    { symbol: "XLU", name: "Utilities Select SPDR", why: "Defensive, dividend-heavy." },
  ],
  materials: [
    { symbol: "XLB", name: "Materials Select SPDR", why: "Miners, chemicals — inflation-sensitive." },
  ],
  communication_services: [
    { symbol: "XLC", name: "Communication Services SPDR", why: "META, GOOGL, NFLX, DIS." },
  ],
};

export function TradeIdeas({
  holdings,
  sectorBias,
  monthlyInvestmentBudget,
}: Props) {
  const [tab, setTab] = useState<"gaps" | "dips">("gaps");

  const { gaps, dips, total } = useMemo(() => {
    type Row = {
      symbol: string;
      name: string;
      value: number;
      costBasis: number;
      gainLoss: number;
      gainPct: number;
      sector: Sector;
    };
    const bySymbol = new Map<string, Row>();
    for (const h of holdings) {
      if (!h.symbol) continue;
      const prev = bySymbol.get(h.symbol);
      if (prev) {
        prev.value += h.currentValue;
        prev.costBasis += h.costBasis;
        prev.gainLoss += h.gainLoss;
      } else {
        bySymbol.set(h.symbol, {
          symbol: h.symbol,
          name: h.name,
          value: h.currentValue,
          costBasis: h.costBasis,
          gainLoss: h.gainLoss,
          gainPct: 0,
          sector: h.sector,
        });
      }
    }
    for (const r of bySymbol.values()) {
      r.gainPct = r.costBasis > 0 ? (r.gainLoss / r.costBasis) * 100 : 0;
    }
    const totalValue =
      [...bySymbol.values()].reduce((s, r) => s + r.value, 0) || 1;

    const sectorPct = new Map<Sector, number>();
    for (const r of bySymbol.values()) {
      sectorPct.set(
        r.sector,
        (sectorPct.get(r.sector) ?? 0) + (r.value / totalValue) * 100
      );
    }

    const candidates: Sector[] = Array.from(
      new Set<Sector>([...sectorBias, "healthcare", "financials", "biotech"])
    );
    const gapRows: SectorGap[] = candidates
      .map((sector) => {
        const currentPct = sectorPct.get(sector) ?? 0;
        const isPreferred = sectorBias.includes(sector);
        const targetPct = isPreferred ? 8 : 4;
        return {
          sector,
          currentPct,
          targetPct,
          gap: targetPct - currentPct,
          suggestions: sectorETFs[sector] ?? [],
        };
      })
      .filter((g) => g.gap > 0 && g.suggestions.length > 0)
      .sort((a, b) => b.gap - a.gap);

    const dipRows: DipCandidate[] = [...bySymbol.values()]
      .filter(
        (r) =>
          r.gainPct < -3 &&
          r.value > 100 &&
          !r.symbol.startsWith("NON") &&
          r.sector !== "crypto"
      )
      .map((r) => ({
        symbol: r.symbol,
        name: r.name,
        currentValue: r.value,
        portfolioPct: (r.value / totalValue) * 100,
        gainLossPercent: r.gainPct,
        sector: r.sector,
        reason:
          r.gainPct < -20
            ? "Significantly below cost — meaningful cost-averaging opportunity if conviction holds."
            : r.gainPct < -10
              ? "Real dip — adding here lowers average cost noticeably."
              : "Modest pullback — small cost-basis improvement.",
      }))
      .sort((a, b) => a.gainLossPercent - b.gainLossPercent)
      .slice(0, 8);

    return { gaps: gapRows, dips: dipRows, total: totalValue };
  }, [holdings, sectorBias]);

  const maxGap = Math.max(...gaps.map((g) => g.gap), 1);

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-semibold">Trade ideas</h3>
          <div className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
            Where your portfolio is thin vs your preferences, and what's in the
            red right now.
          </div>
        </div>
        <div
          className="text-[10px] px-2 py-1 rounded-md text-center"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-faint)",
            maxWidth: 180,
          }}
        >
          Not advice. Do your own research.
        </div>
      </div>

      <div
        className="inline-flex rounded-md overflow-hidden border mb-4"
        style={{ borderColor: "var(--border)" }}
      >
        <TabButton active={tab === "gaps"} onClick={() => setTab("gaps")}>
          Sector gaps{" "}
          <span className="chip ml-1.5" style={{ fontSize: 10 }}>
            {gaps.length}
          </span>
        </TabButton>
        <TabButton active={tab === "dips"} onClick={() => setTab("dips")}>
          Dip candidates{" "}
          <span className="chip ml-1.5" style={{ fontSize: 10 }}>
            {dips.length}
          </span>
        </TabButton>
      </div>

      {tab === "gaps" ? (
        gaps.length === 0 ? (
          <div className="text-[12px] text-[color:var(--text-muted)]">
            No obvious sector gaps — your allocation matches your preferences.
          </div>
        ) : (
          <ul className="space-y-4">
            {gaps.map((g) => (
              <li key={g.sector}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[12.5px] font-medium capitalize">
                    {prettifyLabel(g.sector)}
                  </span>
                  <span
                    className="mono text-[12px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {g.currentPct.toFixed(1)}% → {g.targetPct.toFixed(0)}%
                    <span
                      className="ml-2"
                      style={{ color: "var(--accent-strong)" }}
                    >
                      +{g.gap.toFixed(1)}pp
                    </span>
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden mb-2"
                  style={{ background: "var(--bg-inset)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(g.gap / maxGap) * 100}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.suggestions.map((s) => (
                    <div
                      key={s.symbol}
                      className="inline-flex items-baseline gap-2 px-2.5 py-1 rounded-md text-[11.5px]"
                      style={{
                        background: "var(--bg-inset)",
                        border: "1px solid var(--border)",
                      }}
                      title={s.why}
                    >
                      <span className="mono font-semibold">{s.symbol}</span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {s.name}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : dips.length === 0 ? (
        <div className="text-[12px] text-[color:var(--text-muted)]">
          No meaningful positions in the red — nothing to average down into
          today.
        </div>
      ) : (
        <ul className="space-y-3">
          {dips.map((d) => (
            <li
              key={d.symbol}
              className="pb-3 last:pb-0"
              style={{
                borderBottom:
                  d !== dips[dips.length - 1]
                    ? "1px dotted var(--border)"
                    : "none",
              }}
            >
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="mono font-semibold text-[13px]">
                    {d.symbol}
                  </span>
                  <span
                    className="text-[11.5px] truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {d.name}
                  </span>
                </div>
                <span
                  className="mono text-[12.5px] font-medium"
                  style={{ color: "var(--loss)" }}
                >
                  {formatPercent(d.gainLossPercent)}
                </span>
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-faint)" }}
              >
                {formatCurrency(d.currentValue)} · {d.portfolioPct.toFixed(1)}%
                of portfolio · {prettifyLabel(d.sector)}
              </div>
              <div
                className="text-[11.5px] mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {d.reason}
              </div>
            </li>
          ))}
        </ul>
      )}

      {monthlyInvestmentBudget > 0 && (
        <div
          className="mt-4 pt-3 text-[11px]"
          style={{
            borderTop: "1px dotted var(--border)",
            color: "var(--text-faint)",
          }}
        >
          Monthly investment budget: {formatCurrency(monthlyInvestmentBudget)} ·
          Portfolio total: {formatCurrency(total)}
        </div>
      )}
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-[12px] inline-flex items-baseline"
      style={{
        background: active ? "var(--bg-inset)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}
