import type { InvestmentStrategy } from "@/lib/types";
import { Card } from "./Pill";
import { formatCurrency, prettifyLabel } from "@/lib/format";

interface Props {
  strategy: InvestmentStrategy;
}

export function ActionPlan({ strategy }: Props) {
  const { dcaTargets, tacticalOpportunities, monthlyInvestmentBudget } =
    strategy;

  const totalDcaPercent =
    dcaTargets.reduce((s, t) => s + t.allocationPercent, 0) || 1;

  return (
    <div className="grid md:grid-cols-[1.6fr_1fr] gap-4">
      {/* DCA table */}
      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <h3 className="text-[14px] font-semibold">Action plan</h3>
            <div className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
              Dollar-cost-average targets
              {monthlyInvestmentBudget > 0 && (
                <>
                  {" "}
                  · {formatCurrency(monthlyInvestmentBudget)}/mo budget
                </>
              )}
            </div>
          </div>
        </div>
        {dcaTargets.length === 0 ? (
          <div className="px-5 py-8 text-[12px] text-[color:var(--text-muted)]">
            No DCA targets yet — run an analysis with a set monthly investment
            budget.
          </div>
        ) : (
          <>
            <div
              className="grid text-[10px] uppercase tracking-wider px-5 py-2"
              style={{
                gridTemplateColumns: "80px 1.4fr 1fr 100px 90px",
                color: "var(--text-muted)",
                borderTop: "1px dashed var(--border)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>Symbol</div>
              <div>Name</div>
              <div>Sector</div>
              <div className="text-right">Monthly</div>
              <div className="text-right">Alloc</div>
            </div>
            {dcaTargets.map((t) => (
              <div
                key={t.symbol}
                className="px-5 py-2.5"
                style={{ borderBottom: "1px dotted var(--border)" }}
              >
                <div
                  className="grid text-[12.5px] items-center"
                  style={{
                    gridTemplateColumns: "80px 1.4fr 1fr 100px 90px",
                  }}
                >
                  <div className="mono font-semibold">{t.symbol}</div>
                  <div
                    className="truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t.name}
                  </div>
                  <div
                    className="text-[11px] capitalize"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {prettifyLabel(t.sector)}
                  </div>
                  <div className="mono text-right font-medium">
                    {formatCurrency(t.monthlyAmount)}
                  </div>
                  <div
                    className="mono text-right"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t.allocationPercent.toFixed(0)}%
                  </div>
                </div>
                {/* allocation bar */}
                <div
                  className="mt-1.5 h-1 rounded-full overflow-hidden"
                  style={{ background: "var(--bg-inset)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(t.allocationPercent / totalDcaPercent) * 100}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
                {t.rationale && (
                  <div
                    className="text-[11px] mt-1.5"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {t.rationale}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </Card>

      {/* Tactical opportunities */}
      <Card>
        <h3 className="text-[14px] font-semibold mb-3">
          Tactical opportunities
        </h3>
        {tacticalOpportunities.length === 0 ? (
          <div className="text-[12px] text-[color:var(--text-muted)]">
            No tactical opportunities flagged.
          </div>
        ) : (
          <ul className="space-y-3">
            {tacticalOpportunities.map((opp, i) => (
              <li
                key={i}
                className="pb-3 last:pb-0"
                style={{
                  borderBottom:
                    i < tacticalOpportunities.length - 1
                      ? "1px dotted var(--border)"
                      : "none",
                }}
              >
                <div className="flex items-start gap-2 text-[12.5px] leading-relaxed">
                  <span
                    className="mono shrink-0"
                    style={{ color: "var(--accent-strong)" }}
                  >
                    ›
                  </span>
                  <span>{opp}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
