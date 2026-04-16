"use client";

import type { AnalysisResult, UserProfile } from "@/lib/types";
import DashboardHeader from "./DashboardHeader";
import AccountsOverview from "./AccountsOverview";
import SpendingBreakdown from "./SpendingBreakdown";
import InvestmentAllocation from "./InvestmentAllocation";
import CashFlow from "./CashFlow";
import ActionPlan from "./ActionPlan";
import InsightsPanel from "./InsightsPanel";
import TopHoldings from "./TopHoldings";
import PlatformOverlap from "./PlatformOverlap";
import FinancialSimulation from "./FinancialSimulation";
import MoneyAllocation from "./MoneyAllocation";
import TradeIdeas from "./TradeIdeas";

interface DashboardProps {
  analysis: AnalysisResult;
  userProfile: UserProfile;
}

export default function Dashboard({ analysis, userProfile }: DashboardProps) {
  const totalPortfolioValue = analysis.holdings.reduce(
    (sum, h) => sum + h.currentValue,
    0
  );

  // Pull rent from fixed expenses
  const rentExpense = userProfile.fixedExpenses.find(
    (e) => e.name.toLowerCase() === "rent"
  );
  const monthlyRent = rentExpense ? rentExpense.amount : 1600;

  // Sum fixed expenses for monthly total
  const monthlyFixedExpenses = userProfile.fixedExpenses.reduce((sum, e) => {
    if (e.frequency === "monthly") return sum + e.amount;
    if (e.frequency === "annual") return sum + e.amount / 12;
    if (e.frequency === "quarterly") return sum + e.amount / 3;
    return sum;
  }, 0);

  // Other expenses = total monthly spending minus rent
  const otherMonthlyExpenses = Math.round(
    Math.max(analysis.monthlySpending - monthlyRent, 0) || 500
  );

  const simDefaults = {
    annualSalary: Math.round((userProfile.annualIncome || 134630) / 1000) * 1000,
    monthlyRent,
    roth401kPercent: 15,
    monthlyInvestmentBudget: analysis.strategy?.monthlyInvestmentBudget ?? 2500,
    otherMonthlyExpenses,
    expectedReturnRate: 10,
    currentPortfolioValue: totalPortfolioValue,
  };

  // Liquid cash estimate (savings + cash-like holdings)
  const cashHoldings = analysis.holdings
    .filter(
      (h) =>
        h.assetClass === "cash" ||
        h.symbol === "SWVXX" ||
        h.symbol === "Cash" ||
        h.name.toLowerCase().includes("money market")
    )
    .reduce((sum, h) => sum + h.currentValue, 0);
  const savingsAccount = analysis.accounts.find(
    (a) => a.accountType === "savings"
  );
  const currentEmergencyFund =
    cashHoldings + (savingsAccount?.balance ?? 0);

  const hasRothIRA = analysis.accounts.some(
    (a) => a.accountType === "roth_ira"
  );

  return (
    <div className="space-y-8">
      <DashboardHeader
        netWorth={analysis.netWorth}
        totalAssets={analysis.totalAssets}
        totalLiabilities={analysis.totalLiabilities}
        monthlyIncome={analysis.monthlyIncome}
        monthlySpending={analysis.monthlySpending}
        monthlySavings={analysis.monthlySavings}
        savingsRate={analysis.savingsRate}
        generatedAt={analysis.generatedAt}
      />

      <MoneyAllocation
        monthlyNetPay={analysis.monthlyIncome}
        monthlyFixedExpenses={Math.round(monthlyFixedExpenses)}
        currentEmergencyFund={currentEmergencyFund}
        monthlyExpenseTarget={Math.round(monthlyFixedExpenses + otherMonthlyExpenses - monthlyRent)}
        hasRothIRA={hasRothIRA}
      />

      <AccountsOverview accounts={analysis.accounts} />

      <InvestmentAllocation
        assetAllocation={analysis.assetAllocation}
        sectorExposure={analysis.sectorExposure}
      />

      <TopHoldings holdings={analysis.holdings} />

      <TradeIdeas
        holdings={analysis.holdings}
        sectorPreferences={userProfile.investmentPreferences?.sectorBias ?? []}
        monthlyInvestmentBudget={analysis.strategy?.monthlyInvestmentBudget ?? 2500}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsPanel insights={analysis.insights} />
        <PlatformOverlap holdings={analysis.holdings} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionPlan strategy={analysis.strategy} />
        <CashFlow
          monthlyIncome={analysis.monthlyIncome}
          monthlySpending={analysis.monthlySpending}
          monthlySavings={analysis.monthlySavings}
        />
      </div>

      <SpendingBreakdown data={analysis.spendingBreakdown} />

      <FinancialSimulation defaults={simDefaults} />
    </div>
  );
}
