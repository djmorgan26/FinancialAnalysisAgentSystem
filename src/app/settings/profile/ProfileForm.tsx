"use client";

import { useState } from "react";
import type { UserProfile } from "@/lib/types";
import { Card } from "@/components/app/Pill";
import { PageHeader } from "@/components/app/Page";

const RISK = ["conservative", "moderate", "aggressive"] as const;
const HORIZON = ["short", "medium", "long"] as const;

export function ProfileForm({ initial }: { initial: UserProfile }) {
  const [name, setName] = useState(initial.name ?? "");
  const [age, setAge] = useState(initial.age ? String(initial.age) : "");
  const [occupation, setOccupation] = useState(initial.occupation ?? "");
  const [income, setIncome] = useState(
    initial.annualIncome ? String(initial.annualIncome) : ""
  );
  const [risk, setRisk] = useState<(typeof RISK)[number]>(
    initial.investmentPreferences?.riskTolerance ?? "moderate"
  );
  const [horizon, setHorizon] = useState<(typeof HORIZON)[number]>(
    initial.investmentPreferences?.timeHorizon ?? "long"
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    setToast(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          age: age ? Number(age) : undefined,
          annualIncome: income ? Number(income) : undefined,
          occupation,
          investmentPreferences: {
            riskTolerance: risk,
            timeHorizon: horizon,
            sectorBias: initial.investmentPreferences?.sectorBias ?? [],
          },
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `Failed (${res.status})`);
      }
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
        title="Profile"
        subtitle="Demographic context that underpins recommendations."
      />

      {toast && (
        <div
          className="mb-4 px-3 py-2 rounded text-[12px]"
          style={{
            background: "var(--gain-soft)",
            color: "var(--gain)",
            border: "1px solid color-mix(in oklab, var(--gain) 40%, transparent)",
          }}
        >
          {toast}
        </div>
      )}
      {err && (
        <div
          className="mb-4 px-3 py-2 rounded text-[12px]"
          style={{
            background: "var(--loss-soft)",
            color: "var(--loss)",
            border: "1px solid color-mix(in oklab, var(--loss) 40%, transparent)",
          }}
        >
          {err}
        </div>
      )}

      <Card className="mb-4">
        <h3 className="text-[14px] font-semibold mb-4">Identity</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Age">
            <input
              className="input input-mono"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Occupation">
            <input
              className="input"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
            />
          </Field>
          <Field label="Annual income">
            <input
              className="input input-mono"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="text-[14px] font-semibold mb-4">Risk tolerance</h3>
        <div className="grid grid-cols-3 gap-2">
          {RISK.map((r) => (
            <button
              key={r}
              onClick={() => setRisk(r)}
              className="card p-3 text-left capitalize"
              style={{
                borderColor: risk === r ? "var(--accent)" : "var(--border)",
                background:
                  risk === r ? "var(--accent-soft)" : "var(--bg-elevated)",
              }}
            >
              <div className="text-[13px] font-semibold">{r}</div>
            </button>
          ))}
        </div>
        <h3 className="text-[14px] font-semibold mt-6 mb-4">Time horizon</h3>
        <div className="grid grid-cols-3 gap-2">
          {HORIZON.map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className="card p-3 text-left capitalize"
              style={{
                borderColor: horizon === h ? "var(--accent)" : "var(--border)",
                background:
                  horizon === h ? "var(--accent-soft)" : "var(--bg-elevated)",
              }}
            >
              <div className="text-[13px] font-semibold">{h}</div>
            </button>
          ))}
        </div>
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium mb-1.5 text-[color:var(--text-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}
