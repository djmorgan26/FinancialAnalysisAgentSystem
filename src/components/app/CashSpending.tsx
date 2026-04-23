"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import type {
  AnalysisResult,
  BudgetOverrides,
  FixedExpense,
  UserProfile,
} from "@/lib/types";

type Props = {
  analysis: AnalysisResult | null;
  profile: UserProfile | null;
};

type BucketKey = "necessities" | "investments" | "discretionary" | "savings";

const BUCKET_LABELS: Record<BucketKey, string> = {
  necessities: "Necessities",
  investments: "Investments",
  discretionary: "Discretionary",
  savings: "Savings",
};

const BUCKET_COLORS: Record<BucketKey, string> = {
  necessities: "var(--accent)",
  investments: "var(--gain)",
  discretionary: "var(--text-muted)",
  savings: "var(--accent-strong)",
};

function monthly(expense: FixedExpense): number {
  switch (expense.frequency) {
    case "monthly":
      return expense.amount;
    case "quarterly":
      return expense.amount / 3;
    case "annual":
      return expense.amount / 12;
    default:
      return expense.amount;
  }
}

export function CashSpending({ analysis, profile }: Props) {
  const router = useRouter();
  const strategy = analysis?.strategy;
  const monthlySpending = analysis?.monthlySpending ?? 0;
  const emergencyTarget = strategy?.emergencyFundTarget ?? 0;
  const emergencyCurrent = strategy?.emergencyFundCurrent ?? 0;
  const monthsCovered =
    monthlySpending > 0 ? emergencyCurrent / monthlySpending : 0;
  const efPct =
    emergencyTarget > 0
      ? Math.min(100, (emergencyCurrent / emergencyTarget) * 100)
      : 0;

  const budget = strategy?.monthlyBudget;
  const overrides = profile?.budgetOverrides ?? {};
  const hasAnyOverride = (["necessities", "investments", "discretionary", "savings"] as const)
    .some((k) => typeof overrides[k] === "number");

  const fixedExpenses = profile?.fixedExpenses ?? [];
  const fixedMonthly = useMemo(
    () =>
      [...fixedExpenses]
        .map((e, idx) => ({
          idx,
          name: e.name,
          amount: monthly(e),
          raw: e.amount,
          frequency: e.frequency,
        }))
        .sort((a, b) => b.amount - a.amount),
    [fixedExpenses]
  );
  const fixedTotal = fixedMonthly.reduce((s, e) => s + e.amount, 0);

  const budgetTotal = budget
    ? budget.necessities + budget.investments + budget.discretionary + budget.savings
    : 0;

  const efTone =
    efPct >= 100
      ? "var(--gain)"
      : efPct >= 50
        ? "var(--accent-strong)"
        : "var(--loss)";

  // --- mutation helpers --------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patchProfile(body: Record<string, unknown>) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addExpense(e: FixedExpense) {
    const name = e.name.trim();
    if (!name) {
      setErr("Expense needs a name.");
      return;
    }
    if (!Number.isFinite(e.amount) || e.amount <= 0) {
      setErr("Amount must be positive.");
      return;
    }
    if (
      fixedExpenses.some((x) => x.name.toLowerCase() === name.toLowerCase())
    ) {
      setErr(`"${name}" already exists.`);
      return;
    }
    await patchProfile({
      fixedExpenses: [...fixedExpenses, { ...e, name }],
    });
  }

  async function removeExpense(idx: number) {
    const next = fixedExpenses.filter((_, i) => i !== idx);
    await patchProfile({ fixedExpenses: next });
  }

  async function setBucket(key: BucketKey, value: number | null) {
    const next: BudgetOverrides = { ...(profile?.budgetOverrides ?? {}) };
    if (value === null) delete next[key];
    else next[key] = Math.max(0, Math.round(value));
    const body =
      Object.keys(next).length === 0
        ? { budgetOverrides: null }
        : { budgetOverrides: next };
    await patchProfile(body);
  }

  async function resetBudget() {
    await patchProfile({ budgetOverrides: null });
  }

  async function patchPreferences(body: Record<string, unknown>) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const empty =
    emergencyTarget === 0 && !budget && fixedMonthly.length === 0;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-[14px] font-semibold">Cash &amp; spending</h3>
        <span className="text-[11px] text-[color:var(--text-muted)]">
          {monthlySpending > 0 ? (
            <>
              <span className="mono text-[color:var(--text)]">
                ${Math.round(monthlySpending).toLocaleString()}
              </span>
              {" /mo"}
            </>
          ) : (
            "edit below to personalize"
          )}
        </span>
      </div>

      {err && (
        <div
          className="mb-3 px-3 py-1.5 rounded text-[11.5px]"
          style={{
            background: "var(--loss-soft)",
            color: "var(--loss)",
            border: "1px solid color-mix(in oklab, var(--loss) 40%, transparent)",
          }}
        >
          {err}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Emergency fund */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
              Emergency fund
            </div>
            <Link
              href="/settings/preferences"
              className="text-[10.5px] flex items-center gap-1"
              style={{ color: "var(--text-muted)" }}
              title="Edit in Settings → Preferences"
            >
              <SettingsIcon size={11} />
            </Link>
          </div>
          <div className="mono text-[20px] font-semibold">
            ${Math.round(emergencyCurrent).toLocaleString()}
            <span
              className="text-[12px] font-normal ml-2"
              style={{ color: "var(--text-faint)" }}
            >
              /{" "}
              <EmergencyTargetEditor
                target={emergencyTarget}
                saving={saving}
                onCommit={(v) =>
                  patchPreferences({ emergencyFundTarget: v })
                }
              />
            </span>
          </div>
          <div
            className="text-[11.5px] mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {monthsCovered > 0 ? (
              <>
                <span className="mono" style={{ color: "var(--text)" }}>
                  {monthsCovered.toFixed(1)}
                </span>{" "}
                months of spending covered
              </>
            ) : (
              "No spending baseline yet"
            )}
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-inset)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, efPct)}%`,
                background: efTone,
              }}
            />
          </div>
          <div
            className="text-[10.5px] mt-1.5"
            style={{ color: "var(--text-faint)" }}
          >
            {emergencyTarget <= 0
              ? "Click target to set"
              : efPct >= 100
                ? "Fully funded — excess can be invested"
                : `${efPct.toFixed(0)}% of target`}
          </div>
        </div>

        {/* Monthly budget split */}
        <div>
          <div className="flex items-baseline justify-between mb-2 gap-2">
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
              Monthly budget
            </div>
            <div className="flex items-baseline gap-2">
              {hasAnyOverride && (
                <button
                  onClick={resetBudget}
                  disabled={saving}
                  className="text-[10.5px] underline underline-offset-4"
                  style={{ color: "var(--text-muted)" }}
                  title="Clear all budget overrides"
                >
                  reset
                </button>
              )}
              <Link
                href="/settings/profile"
                className="flex items-baseline"
                style={{ color: "var(--text-muted)" }}
                title="Edit income in Settings → Profile"
              >
                <SettingsIcon size={11} />
              </Link>
            </div>
          </div>
          {budget && budgetTotal > 0 ? (
            <>
              <div
                className="h-2 w-full rounded-full overflow-hidden flex"
                style={{ background: "var(--bg-inset)" }}
              >
                {(["necessities", "investments", "discretionary", "savings"] as const).map(
                  (k) => (
                    <Seg
                      key={k}
                      value={budget[k]}
                      total={budgetTotal}
                      color={BUCKET_COLORS[k]}
                    />
                  )
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-[11.5px]">
                {(["necessities", "investments", "discretionary", "savings"] as const).map(
                  (k) => (
                    <BucketRow
                      key={k}
                      label={BUCKET_LABELS[k]}
                      color={BUCKET_COLORS[k]}
                      amount={budget[k]}
                      total={budgetTotal}
                      overridden={typeof overrides[k] === "number"}
                      saving={saving}
                      onCommit={(v) => setBucket(k, v)}
                    />
                  )
                )}
              </div>
            </>
          ) : (
            <div className="text-[12px] text-[color:var(--text-muted)]">
              {empty
                ? "Add fixed expenses and an annual income to see your budget."
                : "Not computed yet."}
            </div>
          )}
        </div>

        {/* Fixed expenses list + add form */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
              Fixed expenses
            </div>
            {fixedTotal > 0 && (
              <div
                className="mono text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                ${Math.round(fixedTotal).toLocaleString()}/mo
              </div>
            )}
          </div>
          {fixedMonthly.length === 0 ? (
            <div className="text-[12px] text-[color:var(--text-muted)] mb-3">
              No fixed expenses yet. Add your first below.
            </div>
          ) : (
            <ul
              className="space-y-1.5 mb-3 max-h-56 overflow-y-auto pr-1"
              style={{ scrollbarWidth: "thin" }}
            >
              {fixedMonthly.map((e) => (
                <li
                  key={`${e.name}-${e.idx}`}
                  className="flex items-baseline justify-between text-[12px] gap-2"
                >
                  <span className="truncate" title={e.name}>
                    {e.name}
                  </span>
                  <span className="flex items-baseline shrink-0 gap-2">
                    <span
                      className="mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ${Math.round(e.amount).toLocaleString()}
                      <span
                        className="ml-1.5"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {e.frequency === "monthly"
                          ? "/mo"
                          : e.frequency === "quarterly"
                            ? "/qtr→mo"
                            : "/yr→mo"}
                      </span>
                    </span>
                    <button
                      onClick={() => removeExpense(e.idx)}
                      disabled={saving}
                      aria-label={`Remove ${e.name}`}
                      className="text-[13px] leading-none px-1 rounded"
                      style={{ color: "var(--text-faint)" }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <AddExpenseForm disabled={saving} onAdd={addExpense} />
        </div>
      </div>
    </div>
  );
}

function EmergencyTargetEditor({
  target,
  saving,
  onCommit,
}: {
  target: number;
  saving: boolean;
  onCommit: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(String(Math.round(target || 0)));

  function startEdit() {
    setValue(String(Math.round(target || 0)));
    setEditing(true);
  }

  function submit() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    onCommit(n);
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="inline-flex items-baseline gap-1">
        $
        <input
          autoFocus
          className="input input-mono"
          style={{
            width: 80,
            height: 22,
            fontSize: 12,
            padding: "1px 6px",
            display: "inline-block",
          }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={submit}
          inputMode="numeric"
          disabled={saving}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={saving}
      className="mono underline underline-offset-4 decoration-dotted"
      style={{ color: "var(--text-faint)" }}
      title="Click to edit target"
    >
      ${Math.round(target || 0).toLocaleString()}
      {target <= 0 && <span className="ml-1">(set)</span>}
    </button>
  );
}

function Seg({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  if (value <= 0 || total <= 0) return null;
  const pct = (value / total) * 100;
  return <div style={{ width: `${pct}%`, background: color }} />;
}

function BucketRow({
  label,
  color,
  amount,
  total,
  overridden,
  saving,
  onCommit,
}: {
  label: string;
  color: string;
  amount: number;
  total: number;
  overridden: boolean;
  saving: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(String(Math.round(amount)));
  const pct = total > 0 ? (amount / total) * 100 : 0;

  function startEdit() {
    setValue(String(Math.round(amount)));
    setEditing(true);
  }
  function cancel() {
    setEditing(false);
  }
  function submit() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    onCommit(n);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ background: color }}
          />
          <span style={{ color: "var(--text-muted)" }}>{label}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <input
            autoFocus
            className="input input-mono"
            style={{ width: 84, height: 24, fontSize: 11.5, padding: "2px 6px" }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") cancel();
            }}
            inputMode="numeric"
          />
          <button
            onClick={submit}
            disabled={saving}
            className="text-[11px] px-1.5 py-0.5 rounded"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
            title="Save"
          >
            ✓
          </button>
          <button
            onClick={cancel}
            className="text-[11px] px-1 rounded"
            style={{ color: "var(--text-faint)" }}
            title="Cancel"
          >
            ×
          </button>
          {overridden && (
            <button
              onClick={() => {
                onCommit(null);
                setEditing(false);
              }}
              disabled={saving}
              className="text-[10.5px] underline underline-offset-4"
              style={{ color: "var(--text-muted)" }}
              title="Remove override for this bucket"
            >
              reset
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between">
      <span className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-sm"
          style={{ background: color }}
        />
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        {overridden && (
          <span
            className="text-[9.5px] uppercase tracking-wider px-1 py-[1px] rounded"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
            title="Custom override active"
          >
            custom
          </span>
        )}
      </span>
      <button
        onClick={startEdit}
        disabled={saving}
        className="mono text-left"
        title="Click to edit"
      >
        ${Math.round(amount).toLocaleString()}
        <span className="ml-2" style={{ color: "var(--text-faint)" }}>
          {pct.toFixed(0)}%
        </span>
      </button>
    </div>
  );
}

function AddExpenseForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (e: FixedExpense) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] =
    useState<FixedExpense["frequency"]>("monthly");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!name.trim() || !Number.isFinite(amt) || amt <= 0) return;
    onAdd({ name: name.trim(), amount: amt, frequency });
    setName("");
    setAmount("");
    setFrequency("monthly");
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5">
      <input
        className="input"
        style={{ flex: "1 1 100px", height: 28, fontSize: 12, padding: "2px 8px" }}
        placeholder="Name (e.g. Rent)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled}
      />
      <input
        className="input input-mono"
        style={{ width: 84, height: 28, fontSize: 12, padding: "2px 8px" }}
        placeholder="$"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={disabled}
        inputMode="decimal"
      />
      <select
        className="input"
        style={{ width: 92, height: 28, fontSize: 12, padding: "2px 6px" }}
        value={frequency}
        onChange={(e) =>
          setFrequency(e.target.value as FixedExpense["frequency"])
        }
        disabled={disabled}
      >
        <option value="monthly">monthly</option>
        <option value="quarterly">quarterly</option>
        <option value="annual">annual</option>
      </select>
      <button
        type="submit"
        disabled={disabled || !name.trim() || !amount}
        className="btn btn-primary"
        style={{ height: 28, fontSize: 12, padding: "0 10px" }}
      >
        Add
      </button>
    </form>
  );
}
