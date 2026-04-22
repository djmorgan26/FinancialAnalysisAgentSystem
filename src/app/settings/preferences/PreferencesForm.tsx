"use client";

import { useState } from "react";
import type { InvestmentPreferences } from "@/lib/data-store";
import { Card } from "@/components/app/Pill";
import { PageHeader } from "@/components/app/Page";

export function PreferencesForm({
  initial,
}: {
  initial: InvestmentPreferences;
}) {
  const [prefs, setPrefs] = useState<InvestmentPreferences>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState("");
  const [newExclude, setNewExclude] = useState("");

  function update<K extends keyof InvestmentPreferences>(
    key: K,
    value: InvestmentPreferences[K]
  ) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setToast(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setToast("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Investment preferences"
        subtitle={
          <>
            Every field here is read by{" "}
            <code className="mono text-[color:var(--text)]">/invest</code> and
            the AI assistant.
          </>
        }
      />

      {toast && (
        <Alert tone="gain">{toast}</Alert>
      )}
      {err && <Alert tone="loss">{err}</Alert>}

      <Card className="mb-4">
        <h3 className="text-[14px] font-semibold mb-4">Contribution planning</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Roth IRA annual target">
            <NumberInput
              value={prefs.rothIraAnnualTarget}
              onChange={(v) => update("rothIraAnnualTarget", v)}
              suffix="$"
            />
          </Field>
          <Field label="Roth IRA YTD contributed">
            <NumberInput
              value={prefs.rothIraYtdContributed}
              onChange={(v) => update("rothIraYtdContributed", v ?? 0)}
              suffix="$"
            />
          </Field>
          <Field label="Roth 401(k) % of salary">
            <NumberInput
              value={prefs.roth401kPercent}
              onChange={(v) => update("roth401kPercent", v)}
              suffix="%"
            />
          </Field>
          <Field label="Emergency fund target">
            <NumberInput
              value={prefs.emergencyFundTarget}
              onChange={(v) => update("emergencyFundTarget", v)}
              suffix="$"
            />
          </Field>
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="text-[14px] font-semibold mb-4">Guardrails</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Brokerage cash floor">
            <NumberInput
              value={prefs.cashFloorBrokerage}
              onChange={(v) => update("cashFloorBrokerage", v ?? 0)}
              suffix="$"
            />
          </Field>
          <Field label="Single-position cap (%)">
            <NumberInput
              value={prefs.singlePositionCapPercent}
              onChange={(v) => update("singlePositionCapPercent", v)}
              suffix="%"
            />
          </Field>
          <Field label="Core allocation min (%)">
            <NumberInput
              value={prefs.coreAllocationMinPercent}
              onChange={(v) => update("coreAllocationMinPercent", v)}
              suffix="%"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Core tickers"
            hint="Broad-market ETFs / mutual funds considered 'core' allocation."
          >
            <div className="flex flex-wrap gap-1.5">
              {prefs.coreTickers.map((t) => (
                <span key={t} className="chip chip-accent">
                  {t}
                  <button
                    className="ml-1 text-[10px]"
                    onClick={() =>
                      update(
                        "coreTickers",
                        prefs.coreTickers.filter((x) => x !== t)
                      )
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const s = newTicker.trim().toUpperCase();
                  if (s && !prefs.coreTickers.includes(s)) {
                    update("coreTickers", [...prefs.coreTickers, s]);
                  }
                  setNewTicker("");
                }}
              >
                <input
                  className="input input-mono"
                  style={{ width: 110, padding: "3px 8px", fontSize: 11 }}
                  placeholder="+ add"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value)}
                />
              </form>
            </div>
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Excluded tickers"
            hint="Never recommend buying these."
          >
            <div className="flex flex-wrap gap-1.5">
              {prefs.excludedTickers.map((t) => (
                <span key={t} className="chip chip-loss">
                  {t}
                  <button
                    className="ml-1 text-[10px]"
                    onClick={() =>
                      update(
                        "excludedTickers",
                        prefs.excludedTickers.filter((x) => x !== t)
                      )
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const s = newExclude.trim().toUpperCase();
                  if (s && !prefs.excludedTickers.includes(s)) {
                    update("excludedTickers", [...prefs.excludedTickers, s]);
                  }
                  setNewExclude("");
                }}
              >
                <input
                  className="input input-mono"
                  style={{ width: 110, padding: "3px 8px", fontSize: 11 }}
                  placeholder="+ add"
                  value={newExclude}
                  onChange={(e) => setNewExclude(e.target.value)}
                />
              </form>
            </div>
          </Field>
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="text-[14px] font-semibold mb-4">Behavior toggles</h3>
        <div className="space-y-3">
          <Toggle
            label="Allow sell recommendations"
            value={prefs.allowSellRecommendations}
            onChange={(v) => update("allowSellRecommendations", v)}
          />
          <Toggle
            label="Allow tax-loss harvesting"
            value={prefs.allowTaxLossHarvesting}
            onChange={(v) => update("allowTaxLossHarvesting", v)}
          />
          <Field label="Rebalance drift threshold (%)">
            <NumberInput
              value={prefs.rebalanceDriftThresholdPercent}
              onChange={(v) =>
                update("rebalanceDriftThresholdPercent", v ?? 5)
              }
              suffix="%"
            />
          </Field>
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="text-[14px] font-semibold mb-4">Notes for the AI</h3>
        <textarea
          className="input"
          style={{ minHeight: 100, fontFamily: "inherit" }}
          value={prefs.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Anything the AI should always remember. e.g. 'Prefer low-cost ETFs. Avoid individual bank stocks.'"
        />
      </Card>

      <div className="flex items-center justify-end gap-2">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium mb-1.5 text-[color:var(--text-muted)]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] text-[color:var(--text-faint)]">{hint}</p>
      )}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  suffix,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="input input-mono"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        inputMode="decimal"
      />
      {suffix && (
        <span className="text-[11px] text-[color:var(--text-muted)]">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="relative inline-block"
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: value ? "var(--accent)" : "var(--bg-inset)",
          border: "1px solid var(--border)",
          transition: "background 0.15s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: value ? 17 : 1,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            transition: "left 0.15s ease",
          }}
        />
      </button>
    </div>
  );
}

function Alert({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "gain" | "loss" | "info";
}) {
  return (
    <div
      className="mb-4 px-3 py-2 rounded text-[12px]"
      style={{
        background: `var(--${tone}-soft)`,
        color: `var(--${tone})`,
        border: `1px solid color-mix(in oklab, var(--${tone}) 40%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}
