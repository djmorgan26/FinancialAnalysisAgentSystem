"use client";

import { useState, useMemo, useCallback } from "react";
import { formatCurrency } from "@/lib/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

// ---------- Constants & Defaults ----------

interface SimDefaults {
  annualSalary: number;
  monthlyRent: number;
  roth401kPercent: number;
  monthlyInvestmentBudget: number;
  otherMonthlyExpenses: number;
  expectedReturnRate: number;
  currentPortfolioValue: number;
}

interface FinancialSimulationProps {
  defaults: SimDefaults;
}

// Federal + state effective tax rate estimate (simplified)
function estimateTaxRate(annualGross: number): number {
  if (annualGross <= 44725) return 0.22;
  if (annualGross <= 95375) return 0.26;
  if (annualGross <= 182100) return 0.28;
  if (annualGross <= 231250) return 0.30;
  return 0.33;
}

// ---------- Slider Config ----------

interface SliderDef {
  key: keyof SimDefaults;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const sliders: SliderDef[] = [
  {
    key: "annualSalary",
    label: "Annual Salary",
    min: 50000,
    max: 300000,
    step: 1000,
    format: (v) => `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`,
  },
  {
    key: "monthlyRent",
    label: "Monthly Rent",
    min: 500,
    max: 5000,
    step: 100,
    format: (v) => `$${v.toLocaleString()}`,
  },
  {
    key: "roth401kPercent",
    label: "401(k) Contribution",
    min: 0,
    max: 23,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "monthlyInvestmentBudget",
    label: "Monthly Investing",
    min: 0,
    max: 5000,
    step: 100,
    format: (v) => `$${v.toLocaleString()}`,
  },
  {
    key: "otherMonthlyExpenses",
    label: "Other Expenses",
    min: 200,
    max: 5000,
    step: 50,
    format: (v) => `$${v.toLocaleString()}`,
  },
  {
    key: "expectedReturnRate",
    label: "Expected Return",
    min: 0,
    max: 15,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}%`,
  },
];

// ---------- Component ----------

export default function FinancialSimulation({
  defaults,
}: FinancialSimulationProps) {
  const [values, setValues] = useState<SimDefaults>(defaults);

  const handleChange = useCallback(
    (key: keyof SimDefaults, val: number) =>
      setValues((prev) => ({ ...prev, [key]: val })),
    []
  );

  // ---------- Derived calculations ----------

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
    const monthlyTax = monthlyGross * taxRate;
    const monthlyNet = monthlyGross - monthlyTax - monthly401k;

    const fixedExpenses = monthlyRent + otherMonthlyExpenses;
    const totalMonthlyExpenses = fixedExpenses + monthlyInvestmentBudget;
    const freeCash = monthlyNet - totalMonthlyExpenses;
    const savingsRate =
      monthlyNet > 0
        ? ((monthly401k + monthlyInvestmentBudget + Math.max(freeCash, 0)) /
            monthlyGross) *
          100
        : 0;
    const emergencyFundMonths =
      fixedExpenses > 0
        ? currentPortfolioValue * 0.05 / fixedExpenses
        : 0;

    // Bucket breakdown from free cash
    const afterBills = monthlyNet - fixedExpenses;
    const rothIRA = Math.min(583, Math.max(afterBills, 0));
    const autoInvestBucket = monthlyInvestmentBudget;
    const dryPowder = Math.min(500, Math.max(afterBills - rothIRA - autoInvestBucket, 0));
    const funMoney = Math.min(600, Math.max(afterBills - rothIRA - autoInvestBucket - dryPowder, 0));
    const leftover = afterBills - rothIRA - autoInvestBucket - dryPowder - funMoney;

    // Compound growth projection
    const monthlyReturn = expectedReturnRate / 100 / 12;
    const totalMonthlyContribution = monthly401k + monthlyInvestmentBudget;

    const projections = [0, 5, 10, 15, 20, 25, 30].map((year) => {
      const months = year * 12;
      // FV of existing portfolio
      const fvPortfolio =
        currentPortfolioValue * Math.pow(1 + monthlyReturn, months);
      // FV of monthly contributions (annuity)
      const fvContributions =
        monthlyReturn > 0
          ? totalMonthlyContribution *
            ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn)
          : totalMonthlyContribution * months;
      return {
        year,
        label: `${year}yr`,
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
      totalMonthlyExpenses,
      freeCash,
      savingsRate,
      emergencyFundMonths,
      totalMonthlyContribution,
      projections,
      buckets: { rothIRA, autoInvest: autoInvestBucket, dryPowder, funMoney, leftover },
    };
  }, [values]);

  // ---------- Render ----------

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <h2 className="text-lg font-semibold mb-1 text-foreground">
        Financial Simulator
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Adjust the sliders to see how changes cascade through your finances
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ---- Left: Sliders ---- */}
        <div className="space-y-5">
          {sliders.map((s) => (
            <div key={s.key}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium text-foreground tabular-nums">
                  {s.format(values[s.key])}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={values[s.key]}
                onChange={(e) => handleChange(s.key, parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500"
                style={{
                  background: `linear-gradient(to right, #3b82f6 ${((values[s.key] - s.min) / (s.max - s.min)) * 100}%, #404040 ${((values[s.key] - s.min) / (s.max - s.min)) * 100}%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-muted mt-0.5">
                <span>{s.format(s.min)}</span>
                <span>{s.format(s.max)}</span>
              </div>
            </div>
          ))}

          {/* Reset button */}
          <button
            onClick={() => setValues(defaults)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Reset to current values
          </button>
        </div>

        {/* ---- Right: Results ---- */}
        <div className="space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Monthly Net Pay"
              value={formatCurrency(calc.monthlyNet)}
              sub={`Tax: ${formatCurrency(calc.monthlyTax)}`}
            />
            <MetricCard
              label="Monthly 401(k)"
              value={formatCurrency(calc.monthly401k)}
              sub={`${values.roth401kPercent.toFixed(1)}% of gross`}
            />
            <MetricCard
              label="Free Cash"
              value={formatCurrency(calc.freeCash)}
              variant={calc.freeCash >= 0 ? "positive" : "negative"}
              sub="After all expenses"
            />
            <MetricCard
              label="Savings Rate"
              value={`${calc.savingsRate.toFixed(1)}%`}
              variant={calc.savingsRate >= 20 ? "positive" : calc.savingsRate >= 10 ? "neutral" : "negative"}
              sub="Of gross income"
            />
            <MetricCard
              label="Total Monthly Investing"
              value={formatCurrency(calc.totalMonthlyContribution)}
              sub="401(k) + brokerage"
            />
            <MetricCard
              label="Emergency Coverage"
              value={`${calc.emergencyFundMonths.toFixed(1)} mo`}
              variant={calc.emergencyFundMonths >= 6 ? "positive" : calc.emergencyFundMonths >= 3 ? "neutral" : "negative"}
              sub="Liquid reserves"
            />
          </div>

          {/* Monthly breakdown bar */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              Monthly Cash Flow Breakdown
            </p>
            <div className="flex h-4 rounded-full overflow-hidden">
              <Bar
                pct={(values.monthlyRent / calc.monthlyNet) * 100}
                color="#ef4444"
                label="Rent"
              />
              <Bar
                pct={(values.otherMonthlyExpenses / calc.monthlyNet) * 100}
                color="#f97316"
                label="Expenses"
              />
              <Bar
                pct={
                  (values.monthlyInvestmentBudget / calc.monthlyNet) * 100
                }
                color="#22c55e"
                label="Investing"
              />
              <Bar
                pct={(Math.max(calc.freeCash, 0) / calc.monthlyNet) * 100}
                color="#3b82f6"
                label="Free"
              />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              <Legend2 color="#ef4444" label="Rent" />
              <Legend2 color="#f97316" label="Expenses" />
              <Legend2 color="#22c55e" label="Investing" />
              <Legend2 color="#3b82f6" label="Free Cash" />
            </div>
          </div>

          {/* Bucket impact */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              Where Your Free Cash Goes
            </p>
            <div className="space-y-1.5">
              <BucketRow emoji="🏦" label="Roth IRA" amount={calc.buckets.rothIRA} color="#8b5cf6" />
              <BucketRow emoji="📈" label="Auto-Invest" amount={calc.buckets.autoInvest} color="#22c55e" />
              <BucketRow emoji="🎯" label="Buy-the-Dip" amount={calc.buckets.dryPowder} color="#06b6d4" />
              <BucketRow emoji="🍻" label="Fun Money" amount={calc.buckets.funMoney} color="#ec4899" />
              {calc.buckets.leftover !== 0 && (
                <BucketRow
                  emoji={calc.buckets.leftover > 0 ? "💰" : "⚠️"}
                  label={calc.buckets.leftover > 0 ? "Buffer" : "Shortfall"}
                  amount={calc.buckets.leftover}
                  color={calc.buckets.leftover > 0 ? "#404040" : "#ef4444"}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Growth Projection Chart ---- */}
      <div className="mt-8">
        <p className="text-sm font-medium text-foreground mb-3">
          Portfolio Growth Projection
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={calc.projections}
              margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#a3a3a3" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1_000_000
                    ? `$${(v / 1_000_000).toFixed(1)}M`
                    : `$${(v / 1_000).toFixed(0)}k`
                }
                tick={{ fontSize: 12, fill: "#a3a3a3" }}
                axisLine={false}
                tickLine={false}
                width={65}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-card-border bg-[#1a1a1a] px-3 py-2 text-sm shadow-lg">
                      <p className="font-medium text-foreground">
                        Year {d.year}
                      </p>
                      <p className="text-blue-400">
                        Total: {formatCurrency(d.total)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Existing: {formatCurrency(d.portfolio)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        New contributions: {formatCurrency(d.contributions)}
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#3b82f6" }}
                activeDot={{ r: 6, fill: "#60a5fa" }}
                name="Total Portfolio"
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke="#6366f1"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="Existing Growth"
              />
              <Line
                type="monotone"
                dataKey="contributions"
                stroke="#22c55e"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="New Contributions"
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="line"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted mt-2">
          Projections assume {values.expectedReturnRate.toFixed(1)}% annual
          return compounded monthly. Actual results will vary.
        </p>
      </div>
    </section>
  );
}

// ---------- Sub-components ----------

function MetricCard({
  label,
  value,
  sub,
  variant = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "positive" | "negative" | "neutral";
}) {
  const valueColor =
    variant === "positive"
      ? "text-green-400"
      : variant === "negative"
        ? "text-red-400"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-card-border bg-[#161616] p-3">
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${valueColor}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function Bar({
  pct,
  color,
  label,
}: {
  pct: number;
  color: string;
  label: string;
}) {
  const clamped = Math.max(pct, 0);
  if (clamped < 1) return null;
  return (
    <div
      style={{ width: `${clamped}%`, backgroundColor: color }}
      className="transition-all duration-300"
      title={`${label}: ${clamped.toFixed(1)}%`}
    />
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ backgroundColor: color }}
      />
      {label}
    </div>
  );
}

function BucketRow({
  emoji,
  label,
  amount,
  color,
}: {
  emoji: string;
  label: string;
  amount: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        {emoji} {label}
      </span>
      <span className="tabular-nums font-medium" style={{ color }}>
        {amount < 0 ? "−" : ""}{formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}
