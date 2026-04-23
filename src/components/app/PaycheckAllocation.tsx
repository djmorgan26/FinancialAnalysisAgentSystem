"use client";

import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card } from "./Pill";
import { formatCurrency } from "@/lib/format";
import { chartColors, bucketPalette } from "./chartColors";

interface Bucket {
  id: string;
  label: string;
  amount: number;
  color: string;
  description: string;
  tip?: string;
}

interface Props {
  monthlyNetPay: number;
  monthlyFixedExpenses: number;
  currentEmergencyFund: number;
  monthlyExpenseTarget: number;
  hasRothIRA: boolean;
}

export function PaycheckAllocation({
  monthlyNetPay,
  monthlyFixedExpenses,
  currentEmergencyFund,
  monthlyExpenseTarget,
  hasRothIRA,
}: Props) {
  const [openTip, setOpenTip] = useState<string | null>(null);

  const available = Math.max(monthlyNetPay - monthlyFixedExpenses, 0);
  const emergencyMonths =
    monthlyExpenseTarget > 0 ? currentEmergencyFund / monthlyExpenseTarget : 0;
  const needsEmergencyFund = emergencyMonths < 3;

  const buckets = useMemo<Bucket[]>(() => {
    const b: Bucket[] = [];
    const rothAmount = hasRothIRA ? 583 : 0;
    const emergencyAmount = needsEmergencyFund ? 500 : 0;
    const funMoney = Math.min(600, Math.round(available * 0.2));
    const dryPowder = Math.min(500, Math.round(available * 0.15));
    const autoInvest = Math.max(
      available - rothAmount - emergencyAmount - funMoney - dryPowder,
      0
    );

    if (needsEmergencyFund) {
      b.push({
        id: "emergency",
        label: "Emergency fund",
        amount: emergencyAmount,
        color: bucketPalette[1],
        description: `Build to ${formatCurrency(monthlyExpenseTarget * 4)} (4 months). You're at ${emergencyMonths.toFixed(1)} months.`,
        tip: "Set a recurring transfer from checking to savings every payday. Once you hit target, redirect to investing.",
      });
    }
    if (hasRothIRA) {
      b.push({
        id: "roth-ira",
        label: "Roth IRA",
        amount: rothAmount,
        color: bucketPalette[0],
        description:
          "Max out $7,000/yr. Tax-free growth for life — the highest-leverage move in your 20s.",
        tip: "Schwab → Transfers → Recurring Transfers. $291.50 on the 1st and 15th. Inside the IRA, set automatic investing.",
      });
    }
    b.push({
      id: "auto-invest",
      label: "Auto-invest",
      amount: autoInvest,
      color: bucketPalette[3],
      description:
        "Recurring buys across core holdings. Weekly beats monthly for volatility smoothing.",
      tip: "Schwab → Trade → Recurring Investments. Split by target allocation; pick weekly cadence where possible.",
    });
    b.push({
      id: "dry-powder",
      label: "Buy-the-dip",
      amount: dryPowder,
      color: bucketPalette[4],
      description:
        "Liquid capital ready for conviction drops (10%+) in your sectors.",
      tip: "Set Schwab price alerts on your watchlist; deploy from this bucket only when an alert fires.",
    });
    b.push({
      id: "fun",
      label: "Fun money",
      amount: funMoney,
      color: bucketPalette[2],
      description:
        "No-guilt discretionary spending — bars, dinners, gifts. Once it's gone for the month, it's gone.",
      tip: "Consider a separate debit card or a mental envelope. The point is the cap.",
    });
    return b;
  }, [
    available,
    emergencyMonths,
    hasRothIRA,
    monthlyExpenseTarget,
    needsEmergencyFund,
  ]);

  const totalAllocated = buckets.reduce((s, b) => s + b.amount, 0);
  const unallocated = Math.max(available - totalAllocated, 0);

  const pieData = [
    ...buckets.map((b) => ({ name: b.label, value: b.amount, color: b.color })),
    ...(unallocated > 0
      ? [{ name: "Unallocated", value: unallocated, color: chartColors.border }]
      : []),
  ].filter((d) => d.value > 0);

  if (monthlyNetPay <= 0) {
    return (
      <Card>
        <h3 className="text-[14px] font-semibold mb-2">Paycheck allocation</h3>
        <div className="text-[12px] text-[color:var(--text-muted)]">
          Add your annual income in Settings → Profile to see suggested monthly
          buckets.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-[14px] font-semibold">Paycheck allocation</h3>
          <div className="text-[11.5px] text-[color:var(--text-muted)] mt-0.5">
            Where {formatCurrency(available)} /mo should go after fixed costs.
          </div>
        </div>
        <div className="text-right text-[11px]">
          <div style={{ color: "var(--text-muted)" }}>Take-home</div>
          <div className="mono text-[13px] font-semibold">
            {formatCurrency(monthlyNetPay)}
          </div>
          <div className="mt-1.5" style={{ color: "var(--text-muted)" }}>
            Fixed costs
          </div>
          <div
            className="mono text-[13px] font-semibold"
            style={{ color: "var(--loss)" }}
          >
            −{formatCurrency(monthlyFixedExpenses)}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6 mt-5">
        <div className="flex flex-col items-center">
          {pieData.length > 0 ? (
            <div style={{ width: 200, height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: chartColors.bgInset,
                      border: `1px solid ${chartColors.border}`,
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    formatter={(value) => {
                      const n =
                        typeof value === "number" ? value : Number(value);
                      return formatCurrency(Number.isFinite(n) ? n : 0);
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              className="w-[200px] h-[200px] rounded-full flex items-center justify-center text-[11px]"
              style={{ background: "var(--bg-inset)", color: "var(--text-muted)" }}
            >
              No surplus yet
            </div>
          )}
          <div
            className="text-center mt-2 text-[10.5px]"
            style={{ color: "var(--text-faint)" }}
          >
            Allocated {formatCurrency(totalAllocated)}
            {unallocated > 0 && ` · ${formatCurrency(unallocated)} unallocated`}
          </div>
        </div>

        <ul className="space-y-2.5">
          {buckets.map((b) => (
            <li
              key={b.id}
              className="pb-2.5 last:pb-0"
              style={{
                borderBottom:
                  b.id !== buckets[buckets.length - 1]?.id
                    ? "1px dotted var(--border)"
                    : "none",
              }}
            >
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ background: b.color }}
                  />
                  <span className="text-[13px] font-medium">{b.label}</span>
                </div>
                <span className="mono text-[13px] font-semibold">
                  {formatCurrency(b.amount)}
                </span>
              </div>
              <div
                className="text-[11.5px] mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {b.description}
              </div>
              {b.tip && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenTip((cur) => (cur === b.id ? null : b.id))
                    }
                    className="text-[11px] mt-1 underline underline-offset-4"
                    style={{ color: "var(--accent-strong)" }}
                  >
                    {openTip === b.id ? "Hide automation" : "How to automate"}
                  </button>
                  {openTip === b.id && (
                    <div
                      className="mt-1.5 text-[11px] leading-relaxed px-3 py-2 rounded-md whitespace-pre-wrap"
                      style={{
                        background: "var(--bg-inset)",
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {b.tip}
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
