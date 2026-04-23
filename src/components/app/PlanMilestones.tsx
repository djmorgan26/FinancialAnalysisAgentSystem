import { Card } from "./Pill";
import { formatCurrency } from "@/lib/format";

interface Milestone {
  id: string;
  label: string;
  current: number;
  target: number;
  valueFormatter?: (n: number) => string;
  note?: string;
  done?: boolean;
}

interface Props {
  emergencyFundCurrent: number;
  emergencyFundTarget: number;
  rothContributionYTD: number | null;
  rothContributionLimit: number;
  netWorth: number;
  nextNetWorthMilestone: number;
  savingsRate: number;
}

function clampPct(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, current / target));
}

function barColor(pct: number) {
  if (pct >= 1) return "var(--gain)";
  if (pct >= 0.66) return "var(--accent-strong)";
  if (pct >= 0.33) return "var(--info)";
  return "var(--warn)";
}

export function PlanMilestones({
  emergencyFundCurrent,
  emergencyFundTarget,
  rothContributionYTD,
  rothContributionLimit,
  netWorth,
  nextNetWorthMilestone,
  savingsRate,
}: Props) {
  const milestones: Milestone[] = [
    {
      id: "emergency",
      label: "Emergency fund",
      current: emergencyFundCurrent,
      target: emergencyFundTarget,
      done: emergencyFundCurrent >= emergencyFundTarget,
      note:
        emergencyFundCurrent >= emergencyFundTarget
          ? "Target met — redirect this bucket to investing."
          : `${formatCurrency(Math.max(emergencyFundTarget - emergencyFundCurrent, 0))} to go`,
    },
  ];

  if (rothContributionYTD != null) {
    milestones.push({
      id: "roth",
      label: "Roth IRA (this year)",
      current: rothContributionYTD,
      target: rothContributionLimit,
      done: rothContributionYTD >= rothContributionLimit,
      note:
        rothContributionYTD >= rothContributionLimit
          ? "Maxed — highest-leverage move in your 20s, done."
          : `${formatCurrency(rothContributionLimit - rothContributionYTD)} of room left this year`,
    });
  }

  milestones.push({
    id: "networth",
    label: `Next milestone · ${formatCurrency(nextNetWorthMilestone)}`,
    current: netWorth,
    target: nextNetWorthMilestone,
    done: netWorth >= nextNetWorthMilestone,
    note:
      netWorth >= nextNetWorthMilestone
        ? "Hit — set a new target."
        : `${formatCurrency(nextNetWorthMilestone - netWorth)} to go`,
  });

  milestones.push({
    id: "savings",
    label: "Savings rate → 20%",
    current: Math.min(savingsRate, 20),
    target: 20,
    valueFormatter: (n) => `${n.toFixed(0)}%`,
    done: savingsRate >= 20,
    note:
      savingsRate >= 20
        ? "Hitting the 20% benchmark."
        : `${(20 - savingsRate).toFixed(0)} pts to the 20% benchmark`,
  });

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <h3 className="text-[14px] font-semibold">Milestones</h3>
          <div className="text-[11.5px] text-[color:var(--text-muted)] mt-0.5">
            Progress toward the goals that move the needle.
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-4">
        {milestones.map((m) => {
          const pct = clampPct(m.current, m.target);
          const fmt = m.valueFormatter ?? formatCurrency;
          return (
            <li key={m.id}>
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="font-medium">{m.label}</span>
                <span className="mono" style={{ color: "var(--text-muted)" }}>
                  <span
                    style={{
                      color: m.done ? "var(--gain)" : "var(--text)",
                      fontWeight: 600,
                    }}
                  >
                    {fmt(m.current)}
                  </span>
                  <span style={{ color: "var(--text-faint)" }}>
                    {" "}
                    / {fmt(m.target)}
                  </span>
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--bg-inset)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct * 100}%`,
                    background: barColor(pct),
                  }}
                />
              </div>
              {m.note && (
                <div
                  className="text-[11px] mt-1"
                  style={{ color: "var(--text-faint)" }}
                >
                  {m.note}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
