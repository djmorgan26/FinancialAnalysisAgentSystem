import { redirect } from "next/navigation";
import { ShellWrapper } from "@/components/app/ShellWrapper";
import { PageContainer, PageHeader } from "@/components/app/Page";
import { Card } from "@/components/app/Pill";
import { requireUser } from "@/lib/supabase/server";
import {
  loadAnalysis,
  loadFinancialData,
  getOnboardingComplete,
} from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const { user } = await requireUser();
  if (!(await getOnboardingComplete(user.id))) redirect("/onboarding");

  const [analysis, data] = await Promise.all([
    loadAnalysis(user.id),
    loadFinancialData(user.id),
  ]);

  const allHoldings = [...data.holdings].sort(
    (a, b) => b.currentValue - a.currentValue
  );
  const totalValue = allHoldings.reduce((s, h) => s + h.currentValue, 0);
  const costBasis = allHoldings.reduce((s, h) => s + h.costBasis, 0);
  const gainLoss = totalValue - costBasis;
  const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

  return (
    <ShellWrapper>
      <PageContainer>
        <PageHeader
          title="Analysis"
          subtitle="Deep-dive on portfolio composition."
          actions={
            <form action="/api/analysis" method="post">
              <button className="btn btn-sm btn-primary" type="submit">
                Re-run analysis
              </button>
            </form>
          }
        />

        {/* Top row */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
              Total cost basis
            </div>
            <div className="mono text-[24px] font-semibold mt-1">
              ${Math.round(costBasis).toLocaleString()}
            </div>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
              Market value
            </div>
            <div className="mono text-[24px] font-semibold mt-1">
              ${Math.round(totalValue).toLocaleString()}
            </div>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
              Unrealized G/L
            </div>
            <div
              className="mono text-[24px] font-semibold mt-1"
              style={{
                color: gainLoss > 0 ? "var(--gain)" : gainLoss < 0 ? "var(--loss)" : "var(--text)",
              }}
            >
              {gainLoss > 0 ? "+" : ""}${Math.round(gainLoss).toLocaleString()}
            </div>
            <div
              className="text-[12px] mt-1"
              style={{
                color: gainLoss > 0 ? "var(--gain)" : gainLoss < 0 ? "var(--loss)" : "var(--text-muted)",
              }}
            >
              {gainLoss > 0 ? "+" : ""}
              {gainLossPct.toFixed(2)}%
            </div>
          </Card>
        </div>

        {/* Allocation + sector */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card>
            <h3 className="text-[14px] font-semibold mb-4">Asset allocation</h3>
            {analysis?.assetAllocation?.length ? (
              <AllocationRows rows={analysis.assetAllocation} />
            ) : (
              <div className="text-[12px] text-[color:var(--text-muted)]">
                Run analysis to compute allocations.
              </div>
            )}
          </Card>
          <Card>
            <h3 className="text-[14px] font-semibold mb-4">Sector exposure</h3>
            {analysis?.sectorExposure?.length ? (
              <AllocationRows rows={analysis.sectorExposure} />
            ) : (
              <div className="text-[12px] text-[color:var(--text-muted)]">
                Run analysis to compute sector exposure.
              </div>
            )}
          </Card>
        </div>

        {/* Holdings table */}
        <Card padded={false}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h3 className="text-[14px] font-semibold">
              Holdings · {allHoldings.length} positions
            </h3>
          </div>
          <div
            className="grid text-[10px] uppercase tracking-wider px-5 py-2"
            style={{
              gridTemplateColumns:
                "70px 1.4fr 1.1fr 70px 80px 90px 100px 80px",
              color: "var(--text-muted)",
              borderTop: "1px dashed var(--border)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>Symbol</div>
            <div>Name</div>
            <div>Account</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Avg</div>
            <div className="text-right">Price</div>
            <div className="text-right">Value</div>
            <div className="text-right">G/L %</div>
          </div>
          {allHoldings.slice(0, 80).map((h) => {
            const acct = data.accounts.find((a) => a.id === h.accountId);
            return (
              <div
                key={h.id}
                className="grid px-5 py-2 text-[12.5px] items-center"
                style={{
                  gridTemplateColumns:
                    "70px 1.4fr 1.1fr 70px 80px 90px 100px 80px",
                  borderBottom: "1px dotted var(--border)",
                }}
              >
                <div className="mono font-semibold">{h.symbol}</div>
                <div
                  className="truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {h.name}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {acct?.name ?? "—"}
                </div>
                <div className="mono text-right">{h.quantity.toFixed(2)}</div>
                <div
                  className="mono text-right"
                  style={{ color: "var(--text-muted)" }}
                >
                  ${(h.quantity > 0 ? h.costBasis / h.quantity : 0).toFixed(2)}
                </div>
                <div className="mono text-right">
                  ${h.currentPrice.toFixed(2)}
                </div>
                <div className="mono text-right font-medium">
                  ${Math.round(h.currentValue).toLocaleString()}
                </div>
                <div
                  className="mono text-right"
                  style={{
                    color:
                      h.gainLossPercent > 0
                        ? "var(--gain)"
                        : h.gainLossPercent < 0
                          ? "var(--loss)"
                          : "var(--text-muted)",
                  }}
                >
                  {h.gainLossPercent > 0 ? "+" : ""}
                  {h.gainLossPercent.toFixed(1)}%
                </div>
              </div>
            );
          })}
          {allHoldings.length === 0 && (
            <div className="px-5 py-10 text-center text-[12px] text-[color:var(--text-muted)]">
              No holdings yet. Connect an account to get started.
            </div>
          )}
        </Card>
      </PageContainer>
    </ShellWrapper>
  );
}

function AllocationRows({
  rows,
}: {
  rows: { label: string; value: number; percent: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.percent), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between mb-1 text-[12px]">
            <span className="text-[color:var(--text-muted)] capitalize">
              {r.label.replace(/_/g, " ")}
            </span>
            <span className="mono">
              {r.percent.toFixed(1)}%{" "}
              <span
                className="ml-2 font-normal"
                style={{ color: "var(--text-faint)" }}
              >
                ${Math.round(r.value).toLocaleString()}
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
                width: `${(r.percent / max) * 100}%`,
                background: "var(--accent)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
