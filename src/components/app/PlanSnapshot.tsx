import { Card } from "./Pill";
import { formatCompactCurrency } from "@/lib/format";

interface Props {
  monthlyNetPay: number;
  monthlyFixedExpenses: number;
  monthlyInvestmentBudget: number;
  savingsRate: number;
  emergencyMonths: number;
  netWorth: number;
}

interface Metric {
  label: string;
  value: string;
  hint: string;
  tone?: "gain" | "loss" | "warn" | "muted";
}

function toneColor(tone?: Metric["tone"]) {
  switch (tone) {
    case "gain":
      return "var(--gain)";
    case "loss":
      return "var(--loss)";
    case "warn":
      return "var(--warn)";
    case "muted":
      return "var(--text-muted)";
    default:
      return "var(--text)";
  }
}

export function PlanSnapshot({
  monthlyNetPay,
  monthlyFixedExpenses,
  monthlyInvestmentBudget,
  savingsRate,
  emergencyMonths,
  netWorth,
}: Props) {
  const surplus = Math.max(monthlyNetPay - monthlyFixedExpenses, 0);

  const metrics: Metric[] = [
    {
      label: "Net worth",
      value: formatCompactCurrency(netWorth),
      hint: "Assets minus liabilities",
    },
    {
      label: "Monthly surplus",
      value: formatCompactCurrency(surplus),
      hint: `Take-home − fixed costs`,
      tone: surplus <= 0 ? "loss" : surplus < 500 ? "warn" : "gain",
    },
    {
      label: "Savings rate",
      value: `${savingsRate.toFixed(0)}%`,
      hint:
        savingsRate >= 20
          ? "Strong — above 20%"
          : savingsRate >= 10
          ? "OK — aim for 20%+"
          : "Low — push toward 10%+",
      tone:
        savingsRate >= 20
          ? "gain"
          : savingsRate >= 10
          ? undefined
          : "warn",
    },
    {
      label: "Emergency runway",
      value: `${emergencyMonths.toFixed(1)} mo`,
      hint:
        emergencyMonths >= 4
          ? "Fully funded"
          : emergencyMonths >= 3
          ? "Meets 3-month floor"
          : "Below 3-month floor",
      tone:
        emergencyMonths >= 4
          ? "gain"
          : emergencyMonths >= 3
          ? undefined
          : "warn",
    },
    {
      label: "Investing / mo",
      value: formatCompactCurrency(monthlyInvestmentBudget),
      hint: "Post-tax DCA budget",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {metrics.map((m) => (
        <Card key={m.label}>
          <div className="text-[10.5px] uppercase tracking-wider text-[color:var(--text-muted)]">
            {m.label}
          </div>
          <div
            className="mono text-[20px] font-semibold mt-1"
            style={{ color: toneColor(m.tone) }}
          >
            {m.value}
          </div>
          <div
            className="text-[11px] mt-0.5"
            style={{ color: "var(--text-faint)" }}
          >
            {m.hint}
          </div>
        </Card>
      ))}
    </div>
  );
}
