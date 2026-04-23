"use client";

import { useCallback, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { Card } from "./Pill";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { estimateTaxRate } from "@/lib/analysis/tax";
import { chartColors } from "./chartColors";

interface Defaults {
  annualSalary: number;
  monthlyRent: number;
  roth401kPercent: number;
  monthlyInvestmentBudget: number;
  otherMonthlyExpenses: number;
  expectedReturnRate: number;
  currentPortfolioValue: number;
}

interface SliderDef {
  key: keyof Defaults;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderDef[] = [
  {
    key: "annualSalary",
    label: "Annual salary",
    min: 50_000,
    max: 400_000,
    step: 1_000,
    format: (v) => `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`,
  },
  {
    key: "monthlyRent",
    label: "Monthly rent",
    min: 0,
    max: 6_000,
    step: 100,
    format: (v) => `$${v.toLocaleString()}`,
  },
  {
    key: "roth401kPercent",
    label: "401(k) contribution",
    min: 0,
    max: 23,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "monthlyInvestmentBudget",
    label: "Monthly investing (post-tax)",
    min: 0,
    max: 6_000,
    step: 50,
    format: (v) => `$${v.toLocaleString()}`,
  },
  {
    key: "otherMonthlyExpenses",
    label: "Other monthly expenses",
    min: 0,
    max: 6_000,
    step: 50,
    format: (v) => `$${v.toLocaleString()}`,
  },
  {
    key: "expectedReturnRate",
    label: "Expected return",
    min: 0,
    max: 15,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}%`,
  },
];

const PROJECTION_YEARS = [0, 5, 10, 15, 20, 25, 30];

export function FinancialSimulation({ defaults }: { defaults: Defaults }) {
  const [values, setValues] = useState<Defaults>(defaults);

  const set = useCallback(
    (key: keyof Defaults, v: number) =>
      setValues((prev) => ({ ...prev, [key]: v })),
    []
  );

  const calc = useMemo(() => {
    const {
      annualSalary,
      monthlyRent,
      roth401kPercent,
      monthlyInvestmentBudget,
      otherMonthlyExpenses,
      expectedReturnRate,
      currentPortfolioValue,
    } = values;

    const monthlyGross = annualSalary / 12;
    const monthly401k = monthlyGross * (roth401kPercent / 100);
    const taxRate = estimateTaxRate(annualSalary);
    const monthlyTax = (monthlyGross - monthly401k) * taxRate;
    const monthlyNet = monthlyGross - monthlyTax - monthly401k;
    const fixedExpenses = monthlyRent + otherMonthlyExpenses;
    const freeCash = monthlyNet - fixedExpenses - monthlyInvestmentBudget;
    const monthlyContribution = monthly401k + monthlyInvestmentBudget;
    const monthlyReturn = expectedReturnRate / 100 / 12;

    const projections = PROJECTION_YEARS.map((year) => {
      const months = year * 12;
      const fvPortfolio =
        currentPortfolioValue * Math.pow(1 + monthlyReturn, months);
      const fvContributions =
        monthlyReturn > 0
          ? monthlyContribution *
            ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn)
          : monthlyContribution * months;
      return {
        year,
        label: year === 0 ? "Now" : `${year}y`,
        total: Math.round(fvPortfolio + fvContributions),
        portfolio: Math.round(fvPortfolio),
        contributions: Math.round(fvContributions),
      };
    });

    return {
      monthlyGross,
      monthly401k,
      monthlyTax,
      monthlyNet,
      fixedExpenses,
      freeCash,
      monthlyContribution,
      projections,
    };
  }, [values]);

  const finalNetWorth = calc.projections[calc.projections.length - 1].total;

  return (
    <Card>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-[14px] font-semibold">Long-term projection</h3>
          <div className="text-[11.5px] text-[color:var(--text-muted)] mt-0.5">
            Adjust the sliders; watch the 30-year trajectory update.
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-wider text-[color:var(--text-muted)]">
            Projected at 30y
          </div>
          <div className="mono text-[18px] font-semibold">
            {formatCompactCurrency(finalNetWorth)}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-6 mt-5">
        {/* Sliders */}
        <div className="space-y-4">
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between text-[11.5px] mb-1">
                <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
                <span className="mono font-medium">
                  {s.format(values[s.key])}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={values[s.key]}
                onChange={(e) => set(s.key, parseFloat(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${chartColors.accentStrong} ${
                    ((values[s.key] - s.min) / (s.max - s.min)) * 100
                  }%, ${chartColors.border} ${
                    ((values[s.key] - s.min) / (s.max - s.min)) * 100
                  }%)`,
                  accentColor: chartColors.accentStrong,
                }}
              />
            </div>
          ))}

          <div
            className="mt-4 pt-3 grid grid-cols-2 gap-2 text-[11px]"
            style={{ borderTop: "1px dotted var(--border)" }}
          >
            <Stat label="Gross / mo" value={formatCurrency(calc.monthlyGross)} />
            <Stat label="Net / mo" value={formatCurrency(calc.monthlyNet)} />
            <Stat
              label="Tax / mo"
              value={`−${formatCurrency(calc.monthlyTax)}`}
              color="var(--loss)"
            />
            <Stat
              label="401(k) / mo"
              value={formatCurrency(calc.monthly401k)}
              color="var(--gain)"
            />
            <Stat
              label="Investing / mo"
              value={formatCurrency(calc.monthlyContribution)}
              color="var(--gain)"
            />
            <Stat
              label="Free cash / mo"
              value={formatCurrency(calc.freeCash)}
              color={
                calc.freeCash >= 0 ? "var(--text)" : "var(--loss)"
              }
            />
          </div>
        </div>

        {/* Chart */}
        <div style={{ width: "100%", height: 340 }}>
          <ResponsiveContainer>
            <LineChart
              data={calc.projections}
              margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
            >
              <CartesianGrid
                stroke={chartColors.border}
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: chartColors.border }}
                tick={{ fill: chartColors.textMuted, fontSize: 10 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: chartColors.textFaint, fontSize: 10 }}
                tickFormatter={(v: number) => formatCompactCurrency(v)}
                width={60}
              />
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
                labelStyle={{ color: chartColors.textMuted }}
              />
              <Legend
                iconType="circle"
                iconSize={6}
                wrapperStyle={{ fontSize: 10, color: chartColors.textMuted }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Total net worth"
                stroke={chartColors.accentStrong}
                strokeWidth={2}
                dot={{ r: 3, fill: chartColors.accentStrong }}
              />
              <Line
                type="monotone"
                dataKey="contributions"
                name="New contributions"
                stroke={chartColors.gain}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                name="Current portfolio grown"
                stroke={chartColors.warn}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="mono" style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
