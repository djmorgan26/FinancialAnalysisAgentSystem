"use client";

import type { InvestmentStrategy } from "@/lib/types";
import { formatCurrency, prettifyLabel } from "@/lib/format";

interface ActionPlanProps {
  strategy: InvestmentStrategy;
}

export default function ActionPlan({ strategy }: ActionPlanProps) {
  const { dcaTargets, monthlyBudget, tacticalOpportunities } = strategy;
  const hasDCA = dcaTargets.length > 0;
  const hasTactical = tacticalOpportunities.length > 0;
  const hasBudget =
    monthlyBudget.investments > 0 ||
    monthlyBudget.discretionary > 0 ||
    monthlyBudget.savings > 0;

  if (!hasDCA && !hasTactical && !hasBudget) return null;

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <h2 className="text-lg font-semibold mb-4 text-foreground">
        Action Plan
      </h2>

      <div className="space-y-6">
        {/* Monthly Budget Breakdown */}
        {hasBudget && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Monthly Budget
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <BudgetItem
                label="Investments"
                amount={monthlyBudget.investments}
                color="bg-accent"
              />
              <BudgetItem
                label="Savings"
                amount={monthlyBudget.savings}
                color="bg-positive"
              />
              <BudgetItem
                label="Discretionary"
                amount={monthlyBudget.discretionary}
                color="bg-warning"
              />
              <BudgetItem
                label="Total Budget"
                amount={strategy.monthlyInvestmentBudget}
                color="bg-foreground"
              />
            </div>

            {/* Emergency fund progress */}
            {strategy.emergencyFundTarget > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Emergency Fund</span>
                  <span className="tabular-nums text-foreground">
                    {formatCurrency(strategy.emergencyFundCurrent)} /{" "}
                    {formatCurrency(strategy.emergencyFundTarget)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-card-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{
                      width: `${Math.min(100, (strategy.emergencyFundCurrent / strategy.emergencyFundTarget) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* DCA Strategy Table */}
        {hasDCA && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              DCA Strategy
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                      Symbol
                    </th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground">
                      Allocation
                    </th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground">
                      Monthly
                    </th>
                    <th className="text-left py-2 font-medium text-muted-foreground">
                      Sector
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dcaTargets.map((target) => (
                    <tr
                      key={target.symbol}
                      className="border-b border-card-border/50 last:border-0"
                    >
                      <td className="py-2.5 pr-4">
                        <span className="font-mono font-medium text-foreground">
                          {target.symbol}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {target.name}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-foreground">
                        {target.allocationPercent}%
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-foreground">
                        {formatCurrency(target.monthlyAmount)}
                      </td>
                      <td className="py-2.5">
                        <span className="text-xs px-2 py-0.5 rounded-full border border-card-border text-muted-foreground">
                          {prettifyLabel(target.sector)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tactical Opportunities */}
        {hasTactical && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Tactical Opportunities
            </h3>
            <ul className="space-y-2">
              {tacticalOpportunities.map((opp, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="text-accent mt-0.5 flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm11.28-1.78a.75.75 0 00-1.06-1.06L7 8.38 5.78 7.16a.75.75 0 00-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l3.75-3.75z" />
                    </svg>
                  </span>
                  {opp}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function BudgetItem({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number;
  color: string;
}) {
  return (
    <div className="rounded-md border border-card-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-lg font-semibold tabular-nums text-foreground">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}
