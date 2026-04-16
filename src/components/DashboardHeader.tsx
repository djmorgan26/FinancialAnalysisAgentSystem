"use client";

import { formatCurrency, formatDate } from "@/lib/format";

interface DashboardHeaderProps {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlySpending: number;
  monthlySavings: number;
  savingsRate: number;
  generatedAt: string;
}

export default function DashboardHeader({
  netWorth,
  totalAssets,
  totalLiabilities,
  monthlyIncome,
  monthlySpending,
  monthlySavings,
  savingsRate,
  generatedAt,
}: DashboardHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-1">
            Net Worth
          </p>
          <h1 className="text-5xl font-bold tracking-tight tabular-nums">
            {formatCurrency(netWorth)}
          </h1>
          <p className="text-sm text-muted mt-2">
            Updated {formatDate(generatedAt)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SavingsRateBadge rate={savingsRate} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
        <MetricCard label="Total Assets" value={totalAssets} />
        <MetricCard label="Total Liabilities" value={totalLiabilities} negative />
        <MetricCard label="Monthly Income" value={monthlyIncome} />
        <MetricCard label="Monthly Spending" value={monthlySpending} negative />
        <MetricCard label="Monthly Savings" value={monthlySavings} positive={monthlySavings > 0} />
      </div>
    </header>
  );
}

function SavingsRateBadge({ rate }: { rate: number }) {
  const isGood = rate >= 20;
  const isGreat = rate >= 30;

  let bgColor = "bg-negative-muted text-negative";
  if (isGreat) {
    bgColor = "bg-positive-muted text-positive";
  } else if (isGood) {
    bgColor = "bg-accent-muted text-accent";
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${bgColor}`}>
      <span className="text-lg font-bold tabular-nums">{rate.toFixed(1)}%</span>
      <span className="opacity-80">savings rate</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
}) {
  let valueColor = "text-foreground";
  if (positive) valueColor = "text-positive";
  if (negative && value > 0) valueColor = "text-negative";

  return (
    <div className="rounded-lg border border-card-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-lg font-semibold tabular-nums ${valueColor}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
