"use client";

import type { SpendingBreakdown as SpendingBreakdownType } from "@/lib/types";
import { formatCurrency, prettifyLabel } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface SpendingBreakdownProps {
  data: SpendingBreakdownType[];
}

const categoryColors: Record<string, string> = {
  rent: "#ef4444",
  utilities: "#f97316",
  insurance: "#f59e0b",
  food: "#84cc16",
  transportation: "#06b6d4",
  healthcare: "#8b5cf6",
  subscriptions: "#ec4899",
  entertainment: "#a855f7",
  shopping: "#f43f5e",
  investment_buy: "#22c55e",
  investment_sell: "#14b8a6",
  investment_dividend: "#10b981",
  fee: "#ef4444",
  other: "#737373",
};

export default function SpendingBreakdown({ data }: SpendingBreakdownProps) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 10).map((item) => ({
    name: prettifyLabel(item.category),
    category: item.category,
    amount: item.monthlyAverage,
    percent: item.percentOfTotal,
  }));

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <h2 className="text-lg font-semibold mb-4 text-foreground">
        Monthly Spending
      </h2>

      <div className="h-64 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
          >
            <XAxis
              type="number"
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#a3a3a3" }}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-card-border bg-[#1a1a1a] px-3 py-2 text-sm shadow-lg">
                    <p className="font-medium text-foreground">{d.name}</p>
                    <p className="text-muted-foreground">
                      {formatCurrency(d.amount)}/mo
                      <span className="ml-2 text-muted">
                        ({d.percent.toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={categoryColors[entry.category] ?? "#737373"}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {data.slice(0, 8).map((item) => (
          <div
            key={item.category}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    categoryColors[item.category] ?? "#737373",
                }}
              />
              <span className="text-muted-foreground">
                {prettifyLabel(item.category)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="tabular-nums text-foreground font-medium">
                {formatCurrency(item.monthlyAverage)}
              </span>
              <span className="tabular-nums text-muted text-xs w-12 text-right">
                {item.percentOfTotal.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
