"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { chartColors } from "./chartColors";

interface Props {
  monthlyIncome: number;
  monthlySpending: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Simulates a 6-month window of variance around the user's monthly averages.
 * Deterministic: same inputs → same curve. Until we start persisting monthly
 * income/spending in `Snapshot`, this is the best we can do.
 */
function buildSeries(income: number, spending: number) {
  const now = new Date();
  const rows: { month: string; Income: number; Spending: number }[] = [];
  const variance = [0.95, 1.03, 0.92, 1.05, 0.98, 1.02];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = MONTHS[d.getMonth()];
    const vx = variance[5 - i];
    rows.push({
      month: label,
      Income: Math.round(income * (2 - vx)),
      Spending: Math.round(spending * vx),
    });
  }
  return rows;
}

export function CashFlow6Mo({ monthlyIncome, monthlySpending }: Props) {
  const data = useMemo(
    () => buildSeries(monthlyIncome, monthlySpending),
    [monthlyIncome, monthlySpending]
  );

  if (monthlyIncome <= 0 && monthlySpending <= 0) {
    return (
      <div className="text-[12px] text-[color:var(--text-muted)]">
        No income or spending baseline yet.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 180 }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
        >
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: chartColors.border }}
            tick={{ fill: chartColors.textMuted, fontSize: 10 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: chartColors.textFaint, fontSize: 9 }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
          <Tooltip
            cursor={{ fill: chartColors.bgInset }}
            contentStyle={{
              background: chartColors.bgInset,
              border: `1px solid ${chartColors.border}`,
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(Number.isFinite(n) ? n : 0);
            }}
          />
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: 10, color: chartColors.textMuted }}
          />
          <Bar dataKey="Income" fill={chartColors.gain} radius={[2, 2, 0, 0]} />
          <Bar
            dataKey="Spending"
            fill={chartColors.loss}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <div
        className="text-[10px] mt-1"
        style={{ color: "var(--text-faint)" }}
      >
        Last 6 months · modeled from monthly averages
      </div>
    </div>
  );
}
