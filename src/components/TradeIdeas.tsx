"use client";

import { useState, useMemo } from "react";
import type { Holding, Sector } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/format";

// ---------- Types ----------

interface TradeIdeasProps {
  holdings: Holding[];
  sectorPreferences: Sector[];
  monthlyInvestmentBudget: number;
}

interface SectorGap {
  sector: string;
  currentPct: number;
  preferredPct: number;
  gap: number;
  etfSuggestions: { symbol: string; name: string; why: string }[];
}

interface DipCandidate {
  symbol: string;
  name: string;
  currentValue: number;
  portfolioPct: number;
  gainLossPct: number;
  sector: string;
  reason: string;
}

// ---------- Sector ETF Map ----------

const sectorETFs: Record<string, { symbol: string; name: string; why: string }[]> = {
  healthcare: [
    { symbol: "XLV", name: "Health Care Select SPDR", why: "Large-cap healthcare — UNH, LLY, JNJ, ABBV. Stable, diversified." },
    { symbol: "VHT", name: "Vanguard Health Care ETF", why: "Broader healthcare coverage, lower expense ratio than XLV." },
  ],
  biotech: [
    { symbol: "XBI", name: "SPDR S&P Biotech ETF", why: "Equal-weighted biotech. Higher upside, more volatile. Great for long horizon." },
    { symbol: "IBB", name: "iShares Biotech ETF", why: "Cap-weighted biotech — heavier on Amgen, Gilead, Vertex. More stable than XBI." },
  ],
  financials: [
    { symbol: "XLF", name: "Financial Select SPDR", why: "Banks, insurance, fintech. Diversifies away from pure tech." },
    { symbol: "VFH", name: "Vanguard Financials ETF", why: "Broader financials exposure at lower cost." },
  ],
  energy: [
    { symbol: "XLE", name: "Energy Select SPDR", why: "Oil, gas, renewables. Inflation hedge and income." },
    { symbol: "ICLN", name: "iShares Global Clean Energy", why: "Clean energy tilt if you prefer avoiding fossil fuels." },
  ],
  consumer_staples: [
    { symbol: "XLP", name: "Consumer Staples Select SPDR", why: "Defensive — P&G, Costco, Coca-Cola. Holds up in downturns." },
  ],
  industrials: [
    { symbol: "XLI", name: "Industrial Select SPDR", why: "Infrastructure, defense, manufacturing. Cyclical growth." },
  ],
  real_estate: [
    { symbol: "VNQ", name: "Vanguard Real Estate ETF", why: "REITs for income and real asset diversification." },
  ],
  semiconductors: [
    { symbol: "SMH", name: "VanEck Semiconductor ETF", why: "Concentrated semis — NVDA, AVGO, TSM, AMD." },
    { symbol: "SOXX", name: "iShares Semiconductor ETF", why: "Broader semi exposure, slightly different weighting." },
  ],
  ai_ml: [
    { symbol: "BOTZ", name: "Global X Robotics & AI ETF", why: "AI and robotics focused, global exposure." },
  ],
  quantum_computing: [
    { symbol: "QTUM", name: "Defiance Quantum ETF", why: "Quantum computing and machine learning companies." },
  ],
};

const sectorLabels: Record<string, string> = {
  healthcare: "Healthcare",
  biotech: "Biotech",
  financials: "Financials",
  energy: "Energy",
  consumer_staples: "Consumer Staples",
  consumer_discretionary: "Consumer Discretionary",
  industrials: "Industrials",
  real_estate: "Real Estate",
  technology: "Technology",
  semiconductors: "Semiconductors",
  ai_ml: "AI / ML",
  quantum_computing: "Quantum Computing",
  communication_services: "Communications",
  broad_market: "Broad Market",
  other: "Other",
};

// ---------- Component ----------

export default function TradeIdeas({
  holdings,
  sectorPreferences,
  monthlyInvestmentBudget,
}: TradeIdeasProps) {
  const [activeTab, setActiveTab] = useState<"gaps" | "dips">("gaps");

  const analysis = useMemo(() => {
    // Consolidate holdings by symbol
    const bySymbol: Record<string, {
      name: string;
      value: number;
      gainLoss: number;
      costBasis: number;
      gainPct: number;
      sector: string;
    }> = {};

    for (const h of holdings) {
      if (bySymbol[h.symbol]) {
        bySymbol[h.symbol].value += h.currentValue;
        bySymbol[h.symbol].gainLoss += h.gainLoss;
        bySymbol[h.symbol].costBasis += h.costBasis;
      } else {
        bySymbol[h.symbol] = {
          name: h.name,
          value: h.currentValue,
          gainLoss: h.gainLoss,
          costBasis: h.costBasis,
          gainPct: h.gainLossPercent,
          sector: h.sector,
        };
      }
    }

    // Recalculate gain% for consolidated positions
    for (const s of Object.values(bySymbol)) {
      s.gainPct = s.costBasis > 0 ? (s.gainLoss / s.costBasis) * 100 : 0;
    }

    const total = Object.values(bySymbol).reduce((s, h) => s + h.value, 0);

    // Sector breakdown
    const sectors: Record<string, number> = {};
    for (const h of Object.values(bySymbol)) {
      sectors[h.sector] = (sectors[h.sector] || 0) + h.value;
    }
    const sectorPcts: Record<string, number> = {};
    for (const [sec, val] of Object.entries(sectors)) {
      sectorPcts[sec] = (val / total) * 100;
    }

    // Sector gaps — sectors user wants but has < 2% exposure
    const gaps: SectorGap[] = [];
    const allImportantSectors = [
      ...sectorPreferences,
      "healthcare",
      "biotech",
      "financials",
    ] as string[];
    const seen = new Set<string>();

    for (const sec of allImportantSectors) {
      if (seen.has(sec)) continue;
      seen.add(sec);
      const currentPct = sectorPcts[sec] || 0;
      if (currentPct < 2) {
        const isPreferred = (sectorPreferences as string[]).includes(sec);
        const preferredPct = isPreferred ? 8 : 4;
        gaps.push({
          sector: sec,
          currentPct,
          preferredPct,
          gap: preferredPct - currentPct,
          etfSuggestions: sectorETFs[sec] || [],
        });
      }
    }
    gaps.sort((a, b) => b.gap - a.gap);

    // Dip candidates — positions down > 5% with meaningful size
    const dips: DipCandidate[] = [];
    for (const [symbol, data] of Object.entries(bySymbol)) {
      if (
        data.gainPct < -3 &&
        data.value > 100 &&
        data.sector !== "broad_market" &&
        symbol !== "NON40DJPH" &&
        symbol !== "NON40O3YU"
      ) {
        dips.push({
          symbol,
          name: data.name,
          currentValue: data.value,
          portfolioPct: (data.value / total) * 100,
          gainLossPct: data.gainPct,
          sector: data.sector,
          reason:
            data.gainPct < -20
              ? "Significantly below cost basis — big cost-averaging opportunity if conviction holds"
              : data.gainPct < -10
                ? "Meaningful dip — adding here lowers your average cost substantially"
                : "Modest pullback — small cost-basis improvement",
        });
      }
    }
    dips.sort((a, b) => a.gainLossPct - b.gainLossPct);

    // Also add broad market dips
    for (const [symbol, data] of Object.entries(bySymbol)) {
      if (
        data.gainPct < -5 &&
        data.sector === "broad_market" &&
        data.value > 500
      ) {
        dips.push({
          symbol,
          name: data.name,
          currentValue: data.value,
          portfolioPct: (data.value / total) * 100,
          gainLossPct: data.gainPct,
          sector: "broad_market",
          reason: "Index ETF below cost — lowest-risk way to average down",
        });
      }
    }
    dips.sort((a, b) => a.gainLossPct - b.gainLossPct);

    return { gaps, dips, total, sectorPcts };
  }, [holdings, sectorPreferences]);

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Trade Ideas
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Opportunities based on your portfolio gaps and positions in the red
          </p>
        </div>
        <p className="text-[10px] text-muted bg-[#1a1a1a] border border-card-border rounded px-2 py-1 max-w-[180px] text-center">
          Not financial advice. Do your own research before trading.
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 mb-5 bg-[#161616] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("gaps")}
          className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
            activeTab === "gaps"
              ? "bg-card text-foreground font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sector Gaps ({analysis.gaps.length})
        </button>
        <button
          onClick={() => setActiveTab("dips")}
          className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
            activeTab === "dips"
              ? "bg-card text-foreground font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Buy the Dip ({analysis.dips.length})
        </button>
      </div>

      {/* Gap fills */}
      {activeTab === "gaps" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Sectors you want exposure to but are underweight in. ETFs are one way to fill these quickly.
          </p>
          {analysis.gaps.map((gap) => (
            <div
              key={gap.sector}
              className="rounded-lg border border-card-border bg-[#161616] p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {sectorLabels[gap.sector] || gap.sector}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    You have{" "}
                    <span className="text-red-400 font-medium">
                      {gap.currentPct.toFixed(1)}%
                    </span>{" "}
                    — target ~{gap.preferredPct}% based on your preferences
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-[#2a2a2a] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min((gap.currentPct / gap.preferredPct) * 100, 100)}%`,
                          backgroundColor:
                            gap.currentPct < 1
                              ? "#ef4444"
                              : gap.currentPct < gap.preferredPct * 0.5
                                ? "#f59e0b"
                                : "#22c55e",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted tabular-nums w-12 text-right">
                      {gap.currentPct.toFixed(1)}%/{gap.preferredPct}%
                    </span>
                  </div>
                </div>
              </div>

              {gap.etfSuggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {gap.etfSuggestions.map((etf) => (
                    <div
                      key={etf.symbol}
                      className="flex items-start gap-3 rounded-md bg-[#1a1a1a] p-2.5"
                    >
                      <span className="text-sm font-mono font-bold text-blue-400 w-10 shrink-0">
                        {etf.symbol}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {etf.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {etf.why}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dip buys */}
      {activeTab === "dips" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Positions you already own that are below your cost basis. Adding here lowers your average cost.
          </p>
          {analysis.dips.map((dip) => (
            <div
              key={dip.symbol}
              className="rounded-lg border border-card-border bg-[#161616] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="text-center">
                    <span className="text-base font-mono font-bold text-foreground">
                      {dip.symbol}
                    </span>
                    <p className="text-[10px] text-muted mt-0.5">
                      {sectorLabels[dip.sector] || dip.sector}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {dip.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {dip.reason}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-semibold text-red-400 tabular-nums">
                    {formatPercent(dip.gainLossPct)}
                  </p>
                  <p className="text-[10px] text-muted">
                    {formatCurrency(dip.currentValue)} held
                  </p>
                  <p className="text-[10px] text-muted">
                    {dip.portfolioPct.toFixed(1)}% of portfolio
                  </p>
                </div>
              </div>

              {/* Impact preview */}
              <div className="mt-2 pt-2 border-t border-card-border">
                <p className="text-[10px] text-muted-foreground">
                  If you add <span className="text-foreground">$500</span> at
                  today&apos;s price, your new cost basis drops and you need a
                  smaller recovery to break even.
                </p>
              </div>
            </div>
          ))}

          {analysis.dips.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No significant dips right now. Your positions are mostly in the green.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
