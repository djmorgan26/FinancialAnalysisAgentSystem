"use client";

import type { AllocationBreakdown } from "@/lib/types";
import { formatCurrency, prettifyLabel } from "@/lib/format";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface InvestmentAllocationProps {
  assetAllocation: AllocationBreakdown[];
  sectorExposure: AllocationBreakdown[];
}

const assetClassColors = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#a3a3a3", // gray
];

const sectorColors = [
  "#60a5fa",
  "#4ade80",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#22d3ee",
  "#fb7185",
  "#fb923c",
  "#2dd4bf",
  "#818cf8",
  "#e879f9",
  "#34d399",
  "#facc15",
  "#f472b6",
  "#38bdf8",
  "#a3a3a3",
  "#94a3b8",
  "#737373",
];

export default function InvestmentAllocation({
  assetAllocation,
  sectorExposure,
}: InvestmentAllocationProps) {
  if (assetAllocation.length === 0 && sectorExposure.length === 0) return null;

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <h2 className="text-lg font-semibold mb-4 text-foreground">
        Investment Allocation
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {assetAllocation.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Asset Classes
            </h3>
            <DonutChart
              data={assetAllocation}
              colors={assetClassColors}
            />
            <Legend data={assetAllocation} colors={assetClassColors} />
          </div>
        )}

        {sectorExposure.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Sector Exposure
            </h3>
            <DonutChart
              data={sectorExposure}
              colors={sectorColors}
            />
            <Legend data={sectorExposure} colors={sectorColors} />
          </div>
        )}
      </div>
    </section>
  );
}

function DonutChart({
  data,
  colors,
}: {
  data: AllocationBreakdown[];
  colors: string[];
}) {
  return (
    <div className="h-48 mb-3">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length]}
                fillOpacity={0.85}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as AllocationBreakdown;
              return (
                <div className="rounded-lg border border-card-border bg-[#1a1a1a] px-3 py-2 text-sm shadow-lg">
                  <p className="font-medium text-foreground">
                    {prettifyLabel(d.label)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatCurrency(d.value)}{" "}
                    <span className="text-muted">({d.percent}%)</span>
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function Legend({
  data,
  colors,
}: {
  data: AllocationBreakdown[];
  colors: string[];
}) {
  return (
    <div className="space-y-1.5">
      {data.map((item, i) => (
        <div
          key={item.label}
          className="flex items-center justify-between text-sm"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="text-muted-foreground truncate">
              {prettifyLabel(item.label)}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="tabular-nums text-foreground font-medium">
              {formatCurrency(item.value)}
            </span>
            <span className="tabular-nums text-muted text-xs w-10 text-right">
              {item.percent}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
