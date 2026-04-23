import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Cable, Sparkles } from "lucide-react";
import { ShellWrapper } from "@/components/app/ShellWrapper";
import { PageContainer, PageHeader } from "@/components/app/Page";
import { Card, StatusBadge } from "@/components/app/Pill";
import { CashSpending } from "@/components/app/CashSpending";
import { FlagsNewsTabs } from "@/components/app/FlagsNewsTabs";
import { requireUser } from "@/lib/supabase/server";
import {
  createSnapshot,
  getOnboardingComplete,
  loadAnalysis,
  loadFinancialData,
  loadInvestmentPreferences,
  loadUserProfile,
  saveAnalysis,
} from "@/lib/data-store";
import { runAnalysis } from "@/lib/analysis";
import { resolveClassifications } from "@/lib/classification";
import { applyEmergencyFundReconciliation } from "@/lib/emergency-fund-reconcile";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user } = await requireUser();
  if (!(await getOnboardingComplete(user.id))) redirect("/onboarding");

  const [cachedAnalysis, rawData, profile, preferences] = await Promise.all([
    loadAnalysis(user.id),
    loadFinancialData(user.id),
    loadUserProfile(user.id),
    loadInvestmentPreferences(user.id),
  ]);

  // Apply the user's emergency-fund override before anything else sees the
  // data: bump the EF account to the declared balance and debit the same
  // amount from same-platform non-EF cash pools (broker transfers can lag,
  // so without the debit we'd double-count).
  const {
    accounts: recAccounts,
    holdings: recHoldings,
    synthesized: efSynthesized,
  } = applyEmergencyFundReconciliation(rawData.accounts, rawData.holdings, {
    overrideAmount: preferences.emergencyFundCurrentOverride,
    accountIds: preferences.emergencyFundAccountIds,
  });
  const data = { ...rawData, accounts: recAccounts, holdings: recHoldings };

  // If the cached analysis is older than the newest account update, or if
  // no cache exists and we have data, recompute once before rendering.
  let analysis = cachedAnalysis;
  const hasData = data.accounts.length > 0;
  const latestAccountUpdate = data.accounts.reduce(
    (m, a) => (a.lastUpdated > m ? a.lastUpdated : m),
    ""
  );
  // If the EF override produced a different effective balance than what the
  // cache was computed against, force a recompute — the cache can't detect
  // preference-driven shifts on its own.
  const cachedEfCurrent = cachedAnalysis?.strategy?.emergencyFundCurrent ?? 0;
  const efDrifted = efSynthesized > 0 && Math.abs(cachedEfCurrent - efSynthesized) > 1;
  const cacheStale =
    hasData &&
    (!cachedAnalysis ||
      (analysis?.generatedAt ?? "") < latestAccountUpdate ||
      efDrifted);
  if (cacheStale) {
    try {
      const classificationMap = await resolveClassifications(
        data.holdings.map((h) => h.symbol),
        user.id
      );
      const fresh = runAnalysis(data, profile, classificationMap, {
        emergencyFundTarget: preferences.emergencyFundTarget,
        emergencyFundAccountIds: preferences.emergencyFundAccountIds,
        emergencyFundCurrentOverride: preferences.emergencyFundCurrentOverride,
      });
      // Render the fresh result immediately — don't let cache or snapshot
      // persistence failures block the UI from seeing it.
      analysis = fresh;
      saveAnalysis(user.id, fresh).catch((err) =>
        console.error("[dashboard] saveAnalysis failed:", err)
      );
      createSnapshot(user.id, fresh).catch((err) =>
        console.error("[dashboard] createSnapshot failed:", err)
      );
    } catch (err) {
      // runAnalysis itself threw — fall back to cached (or null) so the
      // dashboard still renders with live account sums.
      console.error("[dashboard] analysis recompute failed:", err);
    }
  }

  return (
    <ShellWrapper>
      <PageContainer>
        {!hasData ? (
          <ZeroState />
        ) : (
          <DashboardContent analysis={analysis} data={data} profile={profile} />
        )}
      </PageContainer>
    </ShellWrapper>
  );
}

function DashboardContent({
  analysis,
  data,
  profile,
}: {
  analysis: Awaited<ReturnType<typeof loadAnalysis>>;
  data: Awaited<ReturnType<typeof loadFinancialData>>;
  profile: Awaited<ReturnType<typeof loadUserProfile>>;
}) {
  // Always prefer the live account sum over any cached analysis value —
  // the cache can only lag, never lead.
  const liveAssets = data.accounts.reduce((s, a) => s + a.balance, 0);
  const liabilities = analysis?.totalLiabilities ?? 0;
  const netWorth = liveAssets - liabilities;

  const aggregated = new Map<
    string,
    {
      symbol: string;
      name: string;
      quantity: number;
      currentValue: number;
      costBasis: number;
      gainLossPercent: number;
      accountIds: Set<string>;
    }
  >();
  for (const h of data.holdings) {
    const key = h.symbol || h.name || h.id;
    const prev = aggregated.get(key);
    if (prev) {
      prev.quantity += h.quantity;
      prev.currentValue += h.currentValue;
      prev.costBasis += h.costBasis;
      prev.accountIds.add(h.accountId);
    } else {
      aggregated.set(key, {
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        currentValue: h.currentValue,
        costBasis: h.costBasis,
        gainLossPercent: 0,
        accountIds: new Set([h.accountId]),
      });
    }
  }
  for (const a of aggregated.values()) {
    a.gainLossPercent =
      a.costBasis > 0 ? ((a.currentValue - a.costBasis) / a.costBasis) * 100 : 0;
  }
  const topPositions = [...aggregated.values()]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 10);

  const flags = analysis?.insights ?? [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${data.accounts.length} accounts · ${data.holdings.length} positions · synced ${relativeTime(data.lastUpdated)}`}
        actions={
          <>
            <form action="/api/refresh" method="post">
              <button className="btn btn-sm" type="submit">
                Sync all
              </button>
            </form>
            <Link href="/assistant" className="btn btn-primary btn-sm">
              <Sparkles size={14} />
              Brief
            </Link>
          </>
        }
      />

      {/* Hero row */}
      <div className="grid md:grid-cols-[1.2fr_1fr] gap-4 mb-6">
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
            Total net worth
          </div>
          <div className="mono text-[40px] font-semibold mt-1 tracking-tight">
            ${Math.round(netWorth).toLocaleString()}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12px] text-[color:var(--text-muted)]">
            <span>
              Assets{" "}
              <span className="mono text-[color:var(--text)]">
                ${Math.round(liveAssets).toLocaleString()}
              </span>
            </span>
            <span>
              Liabilities{" "}
              <span className="mono text-[color:var(--text)]">
                ${Math.round(liabilities).toLocaleString()}
              </span>
            </span>
            {analysis?.savingsRate != null && (
              <span>
                Savings rate{" "}
                <span className="mono text-[color:var(--text)]">
                  {analysis.savingsRate.toFixed(1)}%
                </span>
              </span>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <span className="chip chip-accent">Next action</span>
            <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-faint)]">
              AI-suggested
            </span>
          </div>
          <p className="text-[14px] leading-relaxed">
            {flags[0]?.description ??
              "Your data is synced. Ask the assistant what to do next."}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Link href="/assistant" className="btn btn-primary btn-sm">
              See today&rsquo;s brief <ArrowRight size={13} />
            </Link>
            <Link href="/analysis" className="btn btn-ghost btn-sm">
              Open analysis
            </Link>
          </div>
        </Card>
      </div>

      {/* Accounts strip */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[15px] font-semibold">Accounts</h2>
        <Link
          href="/connections"
          className="text-[12px] text-[color:var(--text-muted)] hover:text-[color:var(--text)] underline underline-offset-4"
        >
          Manage connections →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
        {data.accounts.map((a) => (
          <Card key={a.id} className="card-hover">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-[13px] font-semibold leading-tight">
                  {a.name}
                </div>
                <div className="text-[11px] text-[color:var(--text-muted)] mt-0.5 uppercase tracking-wider">
                  {a.platform} · {a.accountType.replace(/_/g, " ")}
                </div>
              </div>
              <StatusBadge
                state={
                  a.platform === "schwab" || a.platform === "coinbase"
                    ? "connected"
                    : "csv-fresh"
                }
              />
            </div>
            <div className="mono text-[22px] font-semibold">
              ${Math.round(a.balance).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
              {data.holdings.filter((h) => h.accountId === a.id).length} positions
            </div>
          </Card>
        ))}
      </div>

      {/* Allocation + flags */}
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-4 mb-6">
        <Card>
          <h3 className="text-[14px] font-semibold mb-4">Asset allocation</h3>
          {analysis?.assetAllocation?.length ? (
            <AllocationRows rows={analysis.assetAllocation} />
          ) : (
            <div className="text-[12px] text-[color:var(--text-muted)]">
              Run an analysis to see allocation detail.
            </div>
          )}
        </Card>
        <Card>
          <FlagsNewsTabs flags={flags} />
        </Card>
      </div>

      {/* Cash & spending */}
      <div className="mb-6">
        <CashSpending analysis={analysis} profile={profile} />
      </div>

      {/* Top positions */}
      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h3 className="text-[14px] font-semibold">Top positions</h3>
          <Link
            href="/analysis"
            className="text-[12px] text-[color:var(--text-muted)] hover:text-[color:var(--text)] underline underline-offset-4"
          >
            View all →
          </Link>
        </div>
        <div
          className="grid text-[10px] uppercase tracking-wider px-5 py-2"
          style={{
            gridTemplateColumns: "80px 1.3fr 1fr 100px 90px 90px",
            color: "var(--text-muted)",
            borderTop: "1px dashed var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>Symbol</div>
          <div>Name</div>
          <div>Held in</div>
          <div className="text-right">Value</div>
          <div className="text-right">Qty</div>
          <div className="text-right">G/L %</div>
        </div>
        {topPositions.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12px] text-[color:var(--text-muted)]">
            No holdings yet.
          </div>
        ) : (
          topPositions.map((h) => {
            const heldIn =
              h.accountIds.size === 1
                ? (data.accounts.find((a) => a.id === [...h.accountIds][0])?.name ?? "—")
                : `${h.accountIds.size} accounts`;
            return (
              <div
                key={h.symbol || h.name}
                className="grid px-5 py-2.5 text-[12.5px] items-center"
                style={{
                  gridTemplateColumns: "80px 1.3fr 1fr 100px 90px 90px",
                  borderBottom: "1px dotted var(--border)",
                }}
              >
                <div className="mono font-semibold">{h.symbol}</div>
                <div
                  className="truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {h.name || "—"}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {heldIn}
                </div>
                <div className="mono text-right font-medium">
                  ${Math.round(h.currentValue).toLocaleString()}
                </div>
                <div
                  className="mono text-right"
                  style={{ color: "var(--text-muted)" }}
                >
                  {h.quantity.toFixed(h.quantity < 1 ? 4 : 2)}
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
                  {(h.gainLossPercent ?? 0).toFixed(1)}%
                </div>
              </div>
            );
          })
        )}
      </Card>
    </>
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
      {rows.slice(0, 8).map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between mb-1 text-[12px]">
            <span className="text-[color:var(--text-muted)]">{r.label}</span>
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

function ZeroState() {
  const cards = [
    { name: "Charles Schwab", sub: "OAuth · live", href: "/connections" },
    { name: "Coinbase", sub: "API key · live", href: "/connections" },
    { name: "Fidelity", sub: "CSV · upload", href: "/connections" },
    { name: "Robinhood", sub: "CSV · upload", href: "/connections" },
  ];
  return (
    <div className="max-w-[860px] mx-auto text-center pt-10">
      <div
        className="w-14 h-14 rounded-xl mx-auto flex items-center justify-center"
        style={{
          background: "var(--accent-soft)",
          color: "var(--accent-strong)",
          border: "1px solid var(--border)",
        }}
      >
        <Cable size={24} />
      </div>
      <h1 className="mt-5 text-[24px] font-semibold tracking-tight">
        Let&rsquo;s connect your first account.
      </h1>
      <p className="mt-2 text-[13px] text-[color:var(--text-muted)]">
        The dashboard comes alive once you connect a brokerage, crypto wallet, or
        retirement account.
      </p>
      <div className="mt-8 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link
            key={c.name}
            href={c.href}
            className="card p-5 card-hover text-left"
          >
            <div className="text-[14px] font-semibold">{c.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)] mt-1">
              {c.sub}
            </div>
            <div className="mt-5 text-[12px] text-[color:var(--accent-strong)]">
              Connect →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
