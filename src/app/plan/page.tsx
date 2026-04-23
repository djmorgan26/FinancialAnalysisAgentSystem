import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ShellWrapper } from "@/components/app/ShellWrapper";
import { PageContainer, PageHeader } from "@/components/app/Page";
import { Card } from "@/components/app/Pill";
import { PaycheckAllocation } from "@/components/app/PaycheckAllocation";
import { ActionPlan } from "@/components/app/ActionPlan";
import { FinancialSimulation } from "@/components/app/FinancialSimulation";
import { PlanSnapshot } from "@/components/app/PlanSnapshot";
import { PlanMilestones } from "@/components/app/PlanMilestones";
import { CashFlowStory } from "@/components/app/CashFlowStory";
import { MoneyLocation } from "@/components/app/MoneyLocation";
import { PortfolioComposition } from "@/components/app/PortfolioComposition";
import { PlanInsights } from "@/components/app/PlanInsights";
import { SpendingCategories } from "@/components/app/SpendingCategories";
import { SectionHeader } from "@/components/app/SectionHeader";
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
import { estimateTaxRate } from "@/lib/analysis/tax";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import type { AnalysisResult } from "@/lib/types";

export const dynamic = "force-dynamic";

function monthly(amount: number, freq: "monthly" | "annual" | "quarterly") {
  if (freq === "monthly") return amount;
  if (freq === "annual") return amount / 12;
  if (freq === "quarterly") return amount / 3;
  return amount;
}

const NET_WORTH_MILESTONES = [
  10_000, 25_000, 50_000, 100_000, 150_000, 200_000, 250_000, 500_000,
  750_000, 1_000_000, 1_500_000, 2_000_000, 5_000_000,
];

function nextNetWorthMilestone(netWorth: number) {
  const next = NET_WORTH_MILESTONES.find((m) => m > netWorth);
  return next ?? netWorth * 1.5;
}

async function rerunAnalysisAction() {
  "use server";
  const { user } = await requireUser();
  const [data, profile, preferences] = await Promise.all([
    loadFinancialData(user.id),
    loadUserProfile(user.id),
    loadInvestmentPreferences(user.id),
  ]);
  if (data.accounts.length === 0) {
    revalidatePath("/plan");
    return;
  }
  const classificationMap = await resolveClassifications(
    data.holdings.map((h) => h.symbol),
    user.id
  );
  const fresh = runAnalysis(data, profile, classificationMap, {
    emergencyFundTarget: preferences.emergencyFundTarget,
    emergencyFundAccountIds: preferences.emergencyFundAccountIds,
    emergencyFundCurrentOverride: preferences.emergencyFundCurrentOverride,
  });
  await Promise.all([
    saveAnalysis(user.id, fresh),
    createSnapshot(user.id, fresh),
  ]);
  revalidatePath("/plan");
}

export default async function PlanPage() {
  const { user } = await requireUser();
  if (!(await getOnboardingComplete(user.id))) redirect("/onboarding");

  const [cachedAnalysis, data, profile, preferences] = await Promise.all([
    loadAnalysis(user.id),
    loadFinancialData(user.id),
    loadUserProfile(user.id),
    loadInvestmentPreferences(user.id),
  ]);

  // Mirror the dashboard's auto-compute: if cache is missing or older than
  // the newest account update, recompute once before rendering so the Plan
  // reflects live balances without forcing the user to click "Re-run".
  const hasAccounts = data.accounts.length > 0;
  let analysis: AnalysisResult | null = cachedAnalysis;
  const latestAccountUpdate = data.accounts.reduce(
    (m, a) => (a.lastUpdated > m ? a.lastUpdated : m),
    ""
  );
  const cacheStale =
    hasAccounts &&
    (!cachedAnalysis ||
      (analysis?.generatedAt ?? "") < latestAccountUpdate);
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
      analysis = fresh;
      saveAnalysis(user.id, fresh).catch((err) =>
        console.error("[plan] saveAnalysis failed:", err)
      );
      createSnapshot(user.id, fresh).catch((err) =>
        console.error("[plan] createSnapshot failed:", err)
      );
    } catch (err) {
      console.error("[plan] analysis recompute failed:", err);
    }
  }

  if (!analysis) {
    return (
      <ShellWrapper>
        <PageContainer>
          <PageHeader
            title="Plan"
            subtitle="From your paycheck to 10 years out."
          />
          <div className="grid md:grid-cols-[1.3fr_1fr] gap-4">
            <Card>
              <h3 className="text-[14px] font-semibold">
                {hasAccounts
                  ? "We couldn't build your plan"
                  : "Connect an account to start"}
              </h3>
              <p
                className="text-[12.5px] mt-1.5 leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {hasAccounts
                  ? "Your accounts are connected but the analysis didn't complete. Try re-running — if it keeps failing, check Connections for sync errors."
                  : "Plan uses your live balances and income to build a paycheck-to-portfolio blueprint. Connect at least one account first."}
              </p>
              <div className="flex items-center gap-2 mt-4">
                {hasAccounts ? (
                  <form action={rerunAnalysisAction}>
                    <button className="btn btn-primary" type="submit">
                      Retry analysis
                    </button>
                  </form>
                ) : (
                  <a href="/connections" className="btn btn-primary">
                    Connect an account
                  </a>
                )}
                <a href="/connections" className="btn btn-ghost">
                  {hasAccounts ? "Check connections" : "Browse connections"}
                </a>
              </div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
                What you&rsquo;ll see
              </div>
              <ul className="mt-3 space-y-2.5 text-[12.5px]">
                {[
                  ["Plan snapshot", "Savings rate, runway, monthly surplus."],
                  ["Cash flow", "Income → spending → savings in one glance."],
                  ["Paycheck allocation", "Where your take-home should go."],
                  ["Milestones", "Emergency fund, Roth IRA, net-worth progress."],
                  ["Portfolio composition", "Asset mix and sector exposure."],
                  ["What to watch", "Warnings and opportunities the analyzer flagged."],
                  ["Action plan", "DCA targets per-ticker with monthly amounts."],
                  ["Long-term projection", "Interactive 30-year trajectory."],
                ].map(([title, desc]) => (
                  <li key={title} className="flex gap-2.5">
                    <span
                      className="mono shrink-0 mt-[1px]"
                      style={{ color: "var(--accent-strong)" }}
                    >
                      ›
                    </span>
                    <span>
                      <span className="font-medium">{title}</span>{" "}
                      <span style={{ color: "var(--text-muted)" }}>
                        — {desc}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </PageContainer>
      </ShellWrapper>
    );
  }

  // ----- Derived values for the plan narrative -----
  const monthlyFixedExpenses = Math.round(
    profile.fixedExpenses.reduce((s, e) => s + monthly(e.amount, e.frequency), 0)
  );
  const rentExpense = profile.fixedExpenses.find((e) =>
    /rent/i.test(e.name)
  );
  const monthlyRent = rentExpense
    ? Math.round(monthly(rentExpense.amount, rentExpense.frequency))
    : 0;

  const hasRothIRA = data.accounts.some((a) => a.accountType === "roth_ira");
  const portfolioValue = data.holdings.reduce(
    (s, h) => s + h.currentValue,
    0
  );
  const netPayFactor =
    1 - estimateTaxRate(profile.annualIncome || analysis.monthlyIncome * 12);
  const monthlyNetPay = Math.round(analysis.monthlyIncome * netPayFactor);
  const monthlyExpenseTarget =
    analysis.monthlySpending || monthlyFixedExpenses;
  const emergencyMonths =
    monthlyExpenseTarget > 0
      ? analysis.strategy.emergencyFundCurrent / monthlyExpenseTarget
      : 0;

  const simDefaults = {
    annualSalary: Math.round((profile.annualIncome || 0) / 1000) * 1000,
    monthlyRent: monthlyRent || 1600,
    roth401kPercent: 10,
    monthlyInvestmentBudget: analysis.strategy.monthlyInvestmentBudget || 500,
    otherMonthlyExpenses: Math.max(monthlyFixedExpenses - monthlyRent, 500),
    expectedReturnRate: 8,
    currentPortfolioValue: Math.round(portfolioValue),
  };

  // ----- Narrative openers, tuned to this user's numbers -----
  const yearsToMillion = (() => {
    const n = analysis.netWorth;
    const m = analysis.monthlySavings;
    if (m <= 0 || n >= 1_000_000) return null;
    // Rough: real return ~6%, monthly compounding
    const r = 0.06 / 12;
    let v = n;
    let months = 0;
    while (v < 1_000_000 && months < 1200) {
      v = v * (1 + r) + m;
      months += 1;
    }
    return months >= 1200 ? null : Math.round(months / 12);
  })();

  const openerLede = (() => {
    const nw = formatCurrency(Math.round(analysis.netWorth));
    const save = formatCurrency(Math.round(analysis.monthlySavings));
    const rate = analysis.savingsRate.toFixed(1);
    const yrs = yearsToMillion
      ? ` At that pace, your first million lands in about ${yearsToMillion} years.`
      : "";
    return `Net worth ${nw}. Saving ${save}/mo (${rate}% rate).${yrs}`;
  })();

  return (
    <ShellWrapper>
      <PageContainer>
        <PageHeader
          title="Plan"
          subtitle="From your paycheck to 10 years out."
          actions={
            <div className="flex items-center gap-3">
              <span
                className="text-[11px]"
                style={{ color: "var(--text-faint)" }}
              >
                Updated {formatRelativeTime(analysis.generatedAt)}
              </span>
              <form action={rerunAnalysisAction}>
                <button className="btn btn-sm btn-primary" type="submit">
                  Re-run analysis
                </button>
              </form>
            </div>
          }
        />

        {/* Opener */}
        <div className="space-y-10">
          <section className="space-y-4">
            <p
              className="text-[13px] leading-relaxed max-w-[900px]"
              style={{ color: "var(--text-muted)" }}
            >
              {openerLede}
            </p>
            <PlanSnapshot
              monthlyNetPay={monthlyNetPay}
              monthlyFixedExpenses={monthlyFixedExpenses}
              monthlyInvestmentBudget={analysis.strategy.monthlyInvestmentBudget}
              savingsRate={analysis.savingsRate}
              emergencyMonths={emergencyMonths}
              netWorth={analysis.netWorth}
            />
          </section>

          {/* 1. Cash flow story */}
          <section>
            <SectionHeader
              eyebrow="Chapter 1"
              title="This month's cash flow"
              lede="Every plan starts with what actually hits your account — and what leaves it. Here's the gap between the two."
            />
            <div className="grid md:grid-cols-[1.3fr_1fr] gap-4">
              <CashFlowStory
                monthlyIncome={analysis.monthlyIncome}
                monthlySpending={analysis.monthlySpending}
                monthlySavings={analysis.monthlySavings}
                savingsRate={analysis.savingsRate}
              />
              <Card>
                <h3 className="text-[14px] font-semibold">
                  Spending by category
                </h3>
                <p
                  className="text-[11.5px] mt-0.5 mb-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  The top categories driving your monthly outflow.
                </p>
                <SpendingCategories data={analysis.spendingBreakdown} />
              </Card>
            </div>
          </section>

          {/* 2. Paycheck allocation */}
          <section>
            <SectionHeader
              eyebrow="Chapter 2"
              title="Your paycheck plan"
              lede="Surplus without a destination becomes lifestyle creep. Here's where each dollar should go before you see it."
            />
            <PaycheckAllocation
              monthlyNetPay={monthlyNetPay}
              monthlyFixedExpenses={monthlyFixedExpenses}
              currentEmergencyFund={analysis.strategy.emergencyFundCurrent}
              monthlyExpenseTarget={monthlyExpenseTarget}
              emergencyFundTarget={analysis.strategy.emergencyFundTarget}
              hasRothIRA={hasRothIRA}
            />
          </section>

          {/* 3. Where the money lives */}
          <section>
            <SectionHeader
              eyebrow="Chapter 3"
              title="Where your money lives"
              lede="Before we look at investments, here's the structural view: which accounts hold the assets and how balanced that footprint is."
            />
            <MoneyLocation
              accountBreakdown={analysis.accountBreakdown}
              totalAssets={analysis.totalAssets}
            />
          </section>

          {/* 4. Portfolio composition */}
          <section>
            <SectionHeader
              eyebrow="Chapter 4"
              title="What you own"
              lede="Your asset mix sets the ceiling on returns; your sector exposure decides how smooth the ride is."
            />
            <PortfolioComposition
              assetAllocation={analysis.assetAllocation}
              sectorExposure={analysis.sectorExposure}
            />
          </section>

          {/* 5. Milestones */}
          <section>
            <SectionHeader
              eyebrow="Chapter 5"
              title="Milestones"
              lede="Progress bars against the goals that actually move the needle — emergency fund, tax-advantaged space, net worth, and your savings rate."
            />
            <PlanMilestones
              emergencyFundCurrent={analysis.strategy.emergencyFundCurrent}
              emergencyFundTarget={analysis.strategy.emergencyFundTarget}
              rothContributionYTD={
                hasRothIRA ? preferences.rothIraYtdContributed : null
              }
              rothContributionLimit={preferences.rothIraAnnualTarget ?? 7000}
              netWorth={analysis.netWorth}
              nextNetWorthMilestone={nextNetWorthMilestone(analysis.netWorth)}
              savingsRate={analysis.savingsRate}
            />
          </section>

          {/* 6. What to watch */}
          <section>
            <SectionHeader
              eyebrow="Chapter 6"
              title="What to watch"
              lede="The analyzer scans for concentration risk, under-utilized tax space, cash drag, and spending drift. Here's what it flagged this run."
            />
            <PlanInsights insights={analysis.insights} />
          </section>

          {/* 7. Action plan */}
          <section>
            <SectionHeader
              eyebrow="Chapter 7"
              title="Action plan"
              lede="Concrete DCA targets and tactical opportunities — the next five moves instead of a vague strategy."
            />
            <ActionPlan strategy={analysis.strategy} />
          </section>

          {/* 8. The long view */}
          <section>
            <SectionHeader
              eyebrow="Chapter 8"
              title="The long view"
              lede="Thirty years is long enough for compounding to do the heavy lifting. Move the sliders to stress-test the scenario."
            />
            <FinancialSimulation defaults={simDefaults} />
          </section>
        </div>
      </PageContainer>
    </ShellWrapper>
  );
}
