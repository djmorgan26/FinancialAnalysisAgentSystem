"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// ---------- Types ----------

interface Bucket {
  id: string;
  label: string;
  emoji: string;
  color: string;
  amount: number;
  description: string;
  automationTip?: string;
}

interface MoneyAllocationProps {
  monthlyNetPay: number;       // total take-home after tax+401k
  monthlyFixedExpenses: number; // rent + insurance + subs
  currentEmergencyFund: number; // liquid cash on hand
  monthlyExpenseTarget: number; // rent + other expenses for emergency calc
  hasRothIRA: boolean;
}

// ---------- Component ----------

export default function MoneyAllocation({
  monthlyNetPay,
  monthlyFixedExpenses,
  currentEmergencyFund,
  monthlyExpenseTarget,
  hasRothIRA,
}: MoneyAllocationProps) {
  const [showAutomation, setShowAutomation] = useState<string | null>(null);

  const available = monthlyNetPay - monthlyFixedExpenses;

  // Emergency fund status
  const emergencyMonths = monthlyExpenseTarget > 0
    ? currentEmergencyFund / monthlyExpenseTarget
    : 0;
  const needsEmergencyFund = emergencyMonths < 3;

  const buckets: Bucket[] = useMemo(() => {
    const b: Bucket[] = [];

    // Bucket 1: Emergency fund (only if under 3 months)
    if (needsEmergencyFund) {
      b.push({
        id: "emergency",
        label: "Emergency Fund",
        emoji: "🛟",
        color: "#f59e0b",
        amount: 500,
        description: `Build to ${formatCurrency(monthlyExpenseTarget * 4)} (4 months of expenses). You're at ${emergencyMonths.toFixed(1)} months now.`,
        automationTip: "Set up a recurring transfer from Schwab checking to Schwab savings every payday. Once you hit your target, redirect this to investing.",
      });
    }

    // Bucket 2: Roth IRA ($7,000/yr = $583.33/mo)
    if (hasRothIRA) {
      b.push({
        id: "roth-ira",
        label: "Roth IRA",
        emoji: "🏦",
        color: "#8b5cf6",
        amount: 583,
        description: "Max out $7,000/yr. Tax-free growth forever — highest-value move at 25.",
        automationTip: "In Schwab: Go to Transfers & Payments → Recurring Transfers. Set up $583/mo from your brokerage to Roth IRA on the 1st and 15th ($291.50 each). Then inside the Roth IRA, set up automatic investing into your chosen funds.",
      });
    }

    // Bucket 3: Auto-invest (core recurring buys)
    const rothAmount = hasRothIRA ? 583 : 0;
    const emergencyAmount = needsEmergencyFund ? 500 : 0;
    const funMoney = 600;
    const dryPowder = 500;
    const autoInvest = Math.max(
      available - rothAmount - emergencyAmount - funMoney - dryPowder,
      0
    );

    b.push({
      id: "auto-invest",
      label: "Auto-Invest",
      emoji: "📈",
      color: "#22c55e",
      amount: Math.round(autoInvest),
      description: "Recurring weekly/monthly buys. Set it and forget it. Split across 2-3 core holdings you already own.",
      automationTip: `In Schwab: Go to Trade → Recurring Investments. Set up automatic buys:\n\n• VOO (S&P 500) — ~50% → ${formatCurrency(autoInvest * 0.5)}/mo\n• QQQM (Nasdaq 100) — ~30% → ${formatCurrency(autoInvest * 0.3)}/mo\n• SCHD (Dividend) — ~20% → ${formatCurrency(autoInvest * 0.2)}/mo\n\nWeekly buys smooth out price fluctuations better than monthly.`,
    });

    // Bucket 4: Dry powder (opportunistic)
    b.push({
      id: "dry-powder",
      label: "Buy-the-Dip Fund",
      emoji: "🎯",
      color: "#06b6d4",
      amount: dryPowder,
      description: "Keep liquid for when your conviction picks drop 10%+. Semis, AI, quantum — your sectors.",
      automationTip: "No automation here — that's the point. This sits as cash in your Schwab brokerage until you see an opportunity. Set price alerts in Schwab for your watchlist:\n\n• NVDA below $120\n• AVGO below $180\n• QBTS below $5\n• SMH below $230\n\nWhen an alert hits, deploy from this bucket.",
    });

    // Bucket 5: Fun money
    b.push({
      id: "fun",
      label: "Fun Money",
      emoji: "🍻",
      color: "#ec4899",
      amount: funMoney,
      description: "Bars, restaurants, golf, whatever. No guilt. This is the number — spend it freely.",
      automationTip: "Transfer $600/mo from Schwab checking to a separate spending account or just mentally earmark it. Some people use a separate debit card. The key: once it's gone for the month, it's gone.",
    });

    return b;
  }, [available, needsEmergencyFund, emergencyMonths, monthlyExpenseTarget, hasRothIRA]);

  const totalAllocated = buckets.reduce((s, b) => s + b.amount, 0);
  const unallocated = available - totalAllocated;

  const pieData = [
    ...buckets.map((b) => ({ name: b.label, value: b.amount, color: b.color })),
    ...(unallocated > 0
      ? [{ name: "Unallocated", value: unallocated, color: "#404040" }]
      : []),
  ];

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Monthly Money Plan
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            How to deploy your {formatCurrency(available)}/mo after fixed expenses
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Take-home</p>
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(monthlyNetPay)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Fixed costs</p>
          <p className="text-sm font-semibold text-red-400 tabular-nums">
            −{formatCurrency(monthlyFixedExpenses)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
        {/* Left: Pie chart */}
        <div className="flex flex-col items-center">
          <div className="h-48 w-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-card-border bg-[#1a1a1a] px-3 py-2 text-sm shadow-lg">
                        <p className="font-medium text-foreground">{d.name}</p>
                        <p className="text-muted-foreground">
                          {formatCurrency(d.value)}/mo
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
            {pieData.map((d) => (
              <div
                key={d.name}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Bucket cards */}
        <div className="lg:col-span-2 space-y-3">
          {buckets.map((bucket) => (
            <div
              key={bucket.id}
              className="rounded-lg border border-card-border bg-[#161616] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{bucket.emoji}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {bucket.label}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      {bucket.description}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p
                    className="text-lg font-bold tabular-nums"
                    style={{ color: bucket.color }}
                  >
                    {formatCurrency(bucket.amount)}
                  </p>
                  <p className="text-[10px] text-muted">/month</p>
                </div>
              </div>

              {/* Automation tip toggle */}
              {bucket.automationTip && (
                <div className="mt-2">
                  <button
                    onClick={() =>
                      setShowAutomation(
                        showAutomation === bucket.id ? null : bucket.id
                      )
                    }
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <span>{showAutomation === bucket.id ? "▾" : "▸"}</span>
                    {showAutomation === bucket.id
                      ? "Hide setup steps"
                      : "How to automate this"}
                  </button>
                  {showAutomation === bucket.id && (
                    <div className="mt-2 rounded-md bg-[#1a1a1a] border border-card-border p-3 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                      {bucket.automationTip}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Summary bar */}
          <div className="flex items-center justify-between pt-2 border-t border-card-border text-sm">
            <span className="text-muted-foreground">Total allocated</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatCurrency(totalAllocated)}/mo
              {unallocated > 0 && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({formatCurrency(unallocated)} buffer)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom: Where the money flows from */}
      <div className="mt-6 pt-4 border-t border-card-border">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Paycheck Flow — What Happens Each Payday
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FlowCard
            title="Schwab Checking — $3,197"
            subtitle="Bills + fun money"
            items={[
              { label: "Rent", amount: "−$1,600", color: "#ef4444" },
              { label: "Car insurance", amount: "−$232", color: "#ef4444" },
              { label: "Subscriptions", amount: "−$90", color: "#ef4444" },
              { label: "Fun money", amount: "−$600", color: "#ec4899" },
              { label: "→ Roth IRA transfer", amount: "−$583", color: "#8b5cf6" },
              { label: "Buffer/overflow", amount: "~$92", color: "#404040" },
            ]}
          />
          <FlowCard
            title="Schwab Brokerage — $3,198"
            subtitle="Investing + dry powder"
            items={[
              { label: "Auto-invest (recurring buys)", amount: `−${formatCurrency(buckets.find(b => b.id === 'auto-invest')?.amount ?? 0)}`, color: "#22c55e" },
              { label: "Buy-the-dip reserve", amount: "−$500", color: "#06b6d4" },
              ...(needsEmergencyFund
                ? [{ label: "→ Emergency fund", amount: "−$500", color: "#f59e0b" }]
                : []),
              {
                label: "Remaining cash",
                amount: `~${formatCurrency(3198 - (buckets.find(b => b.id === 'auto-invest')?.amount ?? 0) - 500 - (needsEmergencyFund ? 500 : 0))}`,
                color: "#404040",
              },
            ]}
          />
        </div>
      </div>

      {/* Already handled automatically */}
      <div className="mt-4 rounded-lg bg-[#161616] border border-card-border p-3">
        <p className="text-xs text-muted-foreground">
          <span className="text-green-400 font-medium">Already automated:</span>{" "}
          $1,683/mo → Fidelity Roth 401(k) at 15% pre-tax. This brings your total monthly investing
          to{" "}
          <span className="text-foreground font-medium">
            {formatCurrency(
              1683 +
                (buckets.find((b) => b.id === "auto-invest")?.amount ?? 0) +
                (buckets.find((b) => b.id === "roth-ira")?.amount ?? 0)
            )}
            /mo
          </span>{" "}
          across 401(k), Roth IRA, and brokerage.
        </p>
      </div>
    </section>
  );
}

// ---------- Sub-components ----------

function FlowCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: { label: string; amount: string; color: string }[];
}) {
  return (
    <div className="rounded-lg border border-card-border bg-[#161616] p-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-[11px] text-muted mb-2">{subtitle}</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex justify-between text-xs"
          >
            <span className="text-muted-foreground">{item.label}</span>
            <span className="tabular-nums font-medium" style={{ color: item.color }}>
              {item.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
