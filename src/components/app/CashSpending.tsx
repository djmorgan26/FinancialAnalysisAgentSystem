import type { AnalysisResult, UserProfile } from "@/lib/types";

type Props = {
  analysis: AnalysisResult | null;
  profile: UserProfile | null;
};

function monthly(expense: UserProfile["fixedExpenses"][number]): number {
  switch (expense.frequency) {
    case "monthly":
      return expense.amount;
    case "quarterly":
      return expense.amount / 3;
    case "annual":
      return expense.amount / 12;
    default:
      return expense.amount;
  }
}

export function CashSpending({ analysis, profile }: Props) {
  const strategy = analysis?.strategy;
  const monthlySpending = analysis?.monthlySpending ?? 0;
  const emergencyTarget = strategy?.emergencyFundTarget ?? 0;
  const emergencyCurrent = strategy?.emergencyFundCurrent ?? 0;
  const monthsCovered =
    monthlySpending > 0 ? emergencyCurrent / monthlySpending : 0;
  const efPct =
    emergencyTarget > 0
      ? Math.min(100, (emergencyCurrent / emergencyTarget) * 100)
      : 0;

  const budget = strategy?.monthlyBudget;
  const budgetTotal = budget
    ? budget.necessities + budget.investments + budget.discretionary + budget.savings
    : 0;

  const fixedMonthly = (profile?.fixedExpenses ?? [])
    .map((e) => ({ name: e.name, amount: monthly(e), frequency: e.frequency }))
    .sort((a, b) => b.amount - a.amount);
  const fixedTotal = fixedMonthly.reduce((s, e) => s + e.amount, 0);

  const efTone =
    efPct >= 100
      ? "var(--gain)"
      : efPct >= 50
        ? "var(--accent-strong)"
        : "var(--loss)";

  const empty =
    emergencyTarget === 0 && !budget && fixedMonthly.length === 0;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-[14px] font-semibold">Cash &amp; spending</h3>
        <span className="text-[11px] text-[color:var(--text-muted)]">
          {monthlySpending > 0 ? (
            <>
              <span className="mono text-[color:var(--text)]">
                ${Math.round(monthlySpending).toLocaleString()}
              </span>
              {" /mo"}
            </>
          ) : (
            "set up profile for details"
          )}
        </span>
      </div>

      {empty ? (
        <div className="text-[12px] text-[color:var(--text-muted)]">
          Add fixed expenses and run analysis from Settings to see your cash
          runway, emergency fund progress, and budget split.
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Emergency fund */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)] mb-2">
              Emergency fund
            </div>
            <div className="mono text-[20px] font-semibold">
              ${Math.round(emergencyCurrent).toLocaleString()}
              <span
                className="text-[12px] font-normal ml-2"
                style={{ color: "var(--text-faint)" }}
              >
                / ${Math.round(emergencyTarget).toLocaleString()}
              </span>
            </div>
            <div
              className="text-[11.5px] mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              {monthsCovered > 0 ? (
                <>
                  <span className="mono" style={{ color: "var(--text)" }}>
                    {monthsCovered.toFixed(1)}
                  </span>{" "}
                  months of spending covered
                </>
              ) : (
                "No spending baseline yet"
              )}
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--bg-inset)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${efPct}%`, background: efTone }}
              />
            </div>
            <div
              className="text-[10.5px] mt-1.5"
              style={{ color: "var(--text-faint)" }}
            >
              {efPct >= 100
                ? "Fully funded — excess can be invested"
                : `${efPct.toFixed(0)}% of target`}
            </div>
          </div>

          {/* Monthly budget split */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)] mb-2">
              Monthly budget
            </div>
            {budget && budgetTotal > 0 ? (
              <>
                <div
                  className="h-2 w-full rounded-full overflow-hidden flex"
                  style={{ background: "var(--bg-inset)" }}
                >
                  <Seg
                    value={budget.necessities}
                    total={budgetTotal}
                    color="var(--accent)"
                  />
                  <Seg
                    value={budget.investments}
                    total={budgetTotal}
                    color="var(--gain)"
                  />
                  <Seg
                    value={budget.discretionary}
                    total={budgetTotal}
                    color="var(--text-muted)"
                  />
                  <Seg
                    value={budget.savings}
                    total={budgetTotal}
                    color="var(--accent-strong)"
                  />
                </div>
                <div className="mt-3 space-y-1.5 text-[11.5px]">
                  <Row
                    label="Necessities"
                    amount={budget.necessities}
                    total={budgetTotal}
                    color="var(--accent)"
                  />
                  <Row
                    label="Investments"
                    amount={budget.investments}
                    total={budgetTotal}
                    color="var(--gain)"
                  />
                  <Row
                    label="Discretionary"
                    amount={budget.discretionary}
                    total={budgetTotal}
                    color="var(--text-muted)"
                  />
                  <Row
                    label="Savings"
                    amount={budget.savings}
                    total={budgetTotal}
                    color="var(--accent-strong)"
                  />
                </div>
              </>
            ) : (
              <div className="text-[12px] text-[color:var(--text-muted)]">
                Not computed yet.
              </div>
            )}
          </div>

          {/* Fixed expenses list */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
                Fixed expenses
              </div>
              {fixedTotal > 0 && (
                <div
                  className="mono text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  ${Math.round(fixedTotal).toLocaleString()}/mo
                </div>
              )}
            </div>
            {fixedMonthly.length === 0 ? (
              <div className="text-[12px] text-[color:var(--text-muted)]">
                No fixed expenses on file. Add them in Settings.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {fixedMonthly.slice(0, 6).map((e, i) => (
                  <li
                    key={`${e.name}-${i}`}
                    className="flex items-baseline justify-between text-[12px]"
                  >
                    <span className="truncate mr-2" title={e.name}>
                      {e.name}
                    </span>
                    <span
                      className="mono shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ${Math.round(e.amount).toLocaleString()}
                      <span
                        className="ml-1.5"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {e.frequency === "monthly"
                          ? "/mo"
                          : e.frequency === "quarterly"
                            ? "/qtr→mo"
                            : "/yr→mo"}
                      </span>
                    </span>
                  </li>
                ))}
                {fixedMonthly.length > 6 && (
                  <li
                    className="text-[11px]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    + {fixedMonthly.length - 6} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Seg({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  if (value <= 0 || total <= 0) return null;
  const pct = (value / total) * 100;
  return <div style={{ width: `${pct}%`, background: color }} />;
}

function Row({
  label,
  amount,
  total,
  color,
}: {
  label: string;
  amount: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-baseline justify-between">
      <span className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-sm"
          style={{ background: color }}
        />
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
      </span>
      <span className="mono">
        ${Math.round(amount).toLocaleString()}
        <span className="ml-2" style={{ color: "var(--text-faint)" }}>
          {pct.toFixed(0)}%
        </span>
      </span>
    </div>
  );
}
