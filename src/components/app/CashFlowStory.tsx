import { Card } from "./Pill";
import { formatCurrency } from "@/lib/format";

interface Props {
  monthlyIncome: number;
  monthlySpending: number;
  monthlySavings: number;
  savingsRate: number;
}

export function CashFlowStory({
  monthlyIncome,
  monthlySpending,
  monthlySavings,
  savingsRate,
}: Props) {
  const spendPct = monthlyIncome > 0 ? monthlySpending / monthlyIncome : 0;
  const savePct = monthlyIncome > 0 ? monthlySavings / monthlyIncome : 0;
  const annualSavings = Math.round(monthlySavings * 12);

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Monthly cash flow</h3>
          <p
            className="text-[11.5px] mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Income in, spending out, savings on deck.
          </p>
        </div>
        <div className="text-right">
          <div
            className="text-[10.5px] uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Saves per year
          </div>
          <div
            className="mono text-[18px] font-semibold"
            style={{ color: "var(--gain)" }}
          >
            {formatCurrency(annualSavings)}
          </div>
        </div>
      </div>

      <div
        className="mt-5 rounded-lg p-4"
        style={{
          background: "var(--bg-inset)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between text-[11px] mb-2">
          <span style={{ color: "var(--text-muted)" }}>Income</span>
          <span className="mono font-semibold text-[13px]">
            {formatCurrency(monthlyIncome)}
          </span>
        </div>
        <div
          className="h-3 rounded-full overflow-hidden flex"
          style={{ background: "var(--border)" }}
        >
          <div
            style={{
              width: `${Math.max(spendPct * 100, 0)}%`,
              background: "var(--loss)",
            }}
            title={`Spending ${formatCurrency(monthlySpending)}`}
          />
          <div
            style={{
              width: `${Math.max(savePct * 100, 0)}%`,
              background: "var(--gain)",
            }}
            title={`Savings ${formatCurrency(monthlySavings)}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <LegendRow
            dot="var(--loss)"
            label="Spending"
            value={formatCurrency(monthlySpending)}
            sub={`${(spendPct * 100).toFixed(0)}% of income`}
          />
          <LegendRow
            dot="var(--gain)"
            label="Savings"
            value={formatCurrency(monthlySavings)}
            sub={`${savingsRate.toFixed(1)}% rate`}
          />
        </div>
      </div>

      <p
        className="mt-4 text-[12px] leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        {narrate(savingsRate, monthlySavings, annualSavings)}
      </p>
    </Card>
  );
}

function narrate(rate: number, monthly: number, annual: number) {
  if (monthly <= 0) {
    return "Spending equals or exceeds income this month — the first lever is trimming fixed costs.";
  }
  const annualStr = `$${annual.toLocaleString()}`;
  if (rate >= 50) {
    return `Elite savings rate. You're keeping more than you spend — ${annualStr} a year feeds your future self instead of lifestyle creep.`;
  }
  if (rate >= 30) {
    return `Strong surplus. At this pace you add ${annualStr} to your balance sheet each year — enough to front-load both retirement and brokerage buckets.`;
  }
  if (rate >= 20) {
    return `Solid — above the 20% benchmark most planners recommend. Annual surplus: ${annualStr}. Worth locking more of it into Roth IRA and 401(k) before it leaks.`;
  }
  if (rate >= 10) {
    return `On the map, but thin margin. Annual surplus: ${annualStr}. The next 5–10 points come from automating transfers before the money feels "yours."`;
  }
  return `Margin is tight. Annual surplus: ${annualStr}. Start with one automated transfer per paycheck — even 1% counts and compounds.`;
}

function LegendRow({
  dot,
  label,
  value,
  sub,
}: {
  dot: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="inline-block w-2 h-2 rounded-full mt-[6px] shrink-0"
        style={{ background: dot }}
      />
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-medium">{label}</span>
          <span className="mono text-[12.5px] font-semibold">{value}</span>
        </div>
        <div
          className="text-[11px]"
          style={{ color: "var(--text-faint)" }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}
