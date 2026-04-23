import { redirect } from "next/navigation";
import { ShellWrapper } from "@/components/app/ShellWrapper";
import { PageContainer, PageHeader } from "@/components/app/Page";
import { Card } from "@/components/app/Pill";
import { PaycheckAllocation } from "@/components/app/PaycheckAllocation";
import { ActionPlan } from "@/components/app/ActionPlan";
import { FinancialSimulation } from "@/components/app/FinancialSimulation";
import { requireUser } from "@/lib/supabase/server";
import {
  getOnboardingComplete,
  loadAnalysis,
  loadFinancialData,
  loadUserProfile,
} from "@/lib/data-store";
import { estimateTaxRate } from "@/lib/analysis/tax";

export const dynamic = "force-dynamic";

function monthly(amount: number, freq: "monthly" | "annual" | "quarterly") {
  if (freq === "monthly") return amount;
  if (freq === "annual") return amount / 12;
  if (freq === "quarterly") return amount / 3;
  return amount;
}

export default async function PlanPage() {
  const { user } = await requireUser();
  if (!(await getOnboardingComplete(user.id))) redirect("/onboarding");

  const [analysis, data, profile] = await Promise.all([
    loadAnalysis(user.id),
    loadFinancialData(user.id),
    loadUserProfile(user.id),
  ]);

  if (!analysis) {
    return (
      <ShellWrapper>
        <PageContainer>
          <PageHeader
            title="Plan"
            subtitle="From your paycheck to 10 years out."
          />
          <Card>
            <div className="text-[12px] text-[color:var(--text-muted)]">
              Run an analysis to build your plan. Connect at least one account
              first, then click{" "}
              <a
                href="/connections"
                className="underline underline-offset-4"
                style={{ color: "var(--accent-strong)" }}
              >
                Connections
              </a>
              .
            </div>
          </Card>
        </PageContainer>
      </ShellWrapper>
    );
  }

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

  const simDefaults = {
    annualSalary: Math.round((profile.annualIncome || 0) / 1000) * 1000,
    monthlyRent: monthlyRent || 1600,
    roth401kPercent: 10,
    monthlyInvestmentBudget: analysis.strategy.monthlyInvestmentBudget || 500,
    otherMonthlyExpenses: Math.max(
      monthlyFixedExpenses - monthlyRent,
      500
    ),
    expectedReturnRate: 8,
    currentPortfolioValue: Math.round(portfolioValue),
  };

  return (
    <ShellWrapper>
      <PageContainer>
        <PageHeader
          title="Plan"
          subtitle="From your paycheck to 10 years out."
          actions={
            <form action="/api/analysis" method="post">
              <button className="btn btn-sm btn-primary" type="submit">
                Re-run analysis
              </button>
            </form>
          }
        />

        <div className="space-y-6">
          <PaycheckAllocation
            monthlyNetPay={monthlyNetPay}
            monthlyFixedExpenses={monthlyFixedExpenses}
            currentEmergencyFund={analysis.strategy.emergencyFundCurrent}
            monthlyExpenseTarget={
              analysis.monthlySpending || monthlyFixedExpenses
            }
            hasRothIRA={hasRothIRA}
          />
          <ActionPlan strategy={analysis.strategy} />
          <FinancialSimulation defaults={simDefaults} />
        </div>
      </PageContainer>
    </ShellWrapper>
  );
}
