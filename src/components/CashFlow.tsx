"use client";

import { formatCurrency } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CashFlowProps {
  monthlyIncome: number;
  monthlySpending: number;
  monthlySavings: number;
}

export default function CashFlow({
  monthlyIncome,
  monthlySpending,
  monthlySavings,
}: CashFlowProps) {
  // Build a simple 6-month view based on the monthly averages.
  // When historical data is available, this would pull from snapshots.
  const months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
  const variance = [0.92, 1.05, 0.97, 1.03, 0.98, 1.0];

  const chartData = months.map((month, i) => ({
    month,
    income: Math.round(monthlyIncome * variance[i]),
    spending: Math.round(monthlySpending * variance[variance.length - 1 - i]),
  }));

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Cash Flow</h2>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block text-sm font-medium tabular-nums ${monthlySavings >= 0 ? "text-positive" : "text-negative"}`}
          >
            {monthlySavings >= 0 ? "+" : ""}
            {formatCurrency(monthlySavings)}
          </span>
          <span className="text-xs text-muted">/mo net</span>
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barGap={2}
          >
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#a3a3a3" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12, fill: "#737373" }}
              width={50}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-card-border bg-[#1a1a1a] px-3 py-2 text-sm shadow-lg">
                    <p className="font-medium text-foreground mb-1">{label}</p>
                    {payload.map((entry) => (
                      <p
                        key={entry.dataKey as string}
                        className="text-muted-foreground"
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5"
                          style={{ backgroundColor: entry.color }}
                        />
                        {entry.dataKey === "income" ? "Income" : "Spending"}:{" "}
                        {formatCurrency(entry.value as number)}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: "#a3a3a3", paddingBottom: 8 }}
              formatter={(value) =>
                value === "income" ? "Income" : "Spending"
              }
            />
            <Bar
              dataKey="income"
              fill="#22c55e"
              fillOpacity={0.7}
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="spending"
              fill="#ef4444"
              fillOpacity={0.7}
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
