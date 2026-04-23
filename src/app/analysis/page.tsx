import { redirect } from "next/navigation";
import { ShellWrapper } from "@/components/app/ShellWrapper";
import { PageContainer, PageHeader } from "@/components/app/Page";
import { Card } from "@/components/app/Pill";
import { PositionsExplorer } from "@/components/app/PositionsExplorer";
import {
  ClassificationReview,
  type CategorizeRow,
} from "@/components/app/ClassificationReview";
import { requireUser } from "@/lib/supabase/server";
import {
  loadFinancialData,
  getOnboardingComplete,
} from "@/lib/data-store";
import {
  applyClassifications,
  resolveClassifications,
  getUserCustomCategories,
} from "@/lib/classification";
import { computeAssetAllocation, computeSectorExposure } from "@/lib/analysis";
import type { Sector } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const { user } = await requireUser();
  if (!(await getOnboardingComplete(user.id))) redirect("/onboarding");

  const data = await loadFinancialData(user.id);

  const allHoldings = [...data.holdings].sort(
    (a, b) => b.currentValue - a.currentValue
  );
  const totalValue = allHoldings.reduce((s, h) => s + h.currentValue, 0);
  const costBasis = allHoldings.reduce((s, h) => s + h.costBasis, 0);
  const gainLoss = totalValue - costBasis;
  const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

  // Find holdings that don't have a confident sector: either no cached
  // classification, or the effective sector is "other" / crypto-only cash
  // buckets that importers couldn't categorize.
  const classificationMap = await resolveClassifications(
    data.holdings.map((h) => h.symbol),
    user.id
  );

  // Compute sector exposure and allocation live, so the UI reflects the
  // current classification state even if the cached analysis row is stale.
  const classifiedHoldings = applyClassifications(data.holdings, classificationMap);
  const liveSectorExposure = computeSectorExposure(classifiedHoldings, classificationMap);
  const liveAssetAllocation = computeAssetAllocation(classifiedHoldings);
  const customCategories = await getUserCustomCategories(user.id);

  const categorizeRows: CategorizeRow[] = (() => {
    const bySymbol = new Map<string, CategorizeRow>();
    for (const h of data.holdings) {
      if (h.assetClass === "cash") continue;
      const upper = h.symbol.toUpperCase();
      const c = classificationMap.get(upper);
      const savedSector: Sector | null =
        c && c.source === "manual" ? c.sector : null;
      const savedCustomCategoryId: string | null =
        c && c.source === "manual" ? c.customCategoryId ?? null : null;
      const cacheSector: Sector | null =
        c && (c.source === "ai" || c.source === "heuristic") ? c.sector : null;
      const prev = bySymbol.get(upper);
      if (prev) {
        prev.currentValue += h.currentValue;
      } else {
        bySymbol.set(upper, {
          symbol: upper,
          name: h.name,
          currentValue: h.currentValue,
          savedSector,
          savedCustomCategoryId,
          cacheSector,
        });
      }
    }
    return [...bySymbol.values()]
      .filter((r) => r.currentValue > 0)
      .sort((a, b) => {
        const aCat = a.savedSector || a.savedCustomCategoryId ? 1 : 0;
        const bCat = b.savedSector || b.savedCustomCategoryId ? 1 : 0;
        if (aCat !== bCat) return aCat - bCat; // uncategorized first
        return b.currentValue - a.currentValue;
      });
  })();

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

        <ClassificationReview
          rows={categorizeRows}
          customCategories={customCategories}
        />

        {/* Allocation + sector */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card>
            <h3 className="text-[14px] font-semibold mb-4">Asset allocation</h3>
            {liveAssetAllocation.length ? (
              <AllocationRows rows={liveAssetAllocation} />
            ) : (
              <div className="text-[12px] text-[color:var(--text-muted)]">
                No holdings to analyze.
              </div>
            )}
          </Card>
          <Card>
            <h3 className="text-[14px] font-semibold mb-4">Sector exposure</h3>
            {liveSectorExposure.length ? (
              <AllocationRows rows={liveSectorExposure} />
            ) : (
              <div className="text-[12px] text-[color:var(--text-muted)]">
                No holdings to analyze.
              </div>
            )}
          </Card>
        </div>

        <PositionsExplorer holdings={data.holdings} accounts={data.accounts} />
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
