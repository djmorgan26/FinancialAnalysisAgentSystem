"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

const SECTORS = [
  "technology",
  "ai_ml",
  "semiconductors",
  "healthcare",
  "biotech",
  "energy",
  "financials",
  "real_estate",
  "consumer_discretionary",
];

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1 — identity
  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [income, setIncome] = useState<string>("");
  const [occupation, setOccupation] = useState("");

  // Step 2 — risk profile
  const [risk, setRisk] = useState<"conservative" | "moderate" | "aggressive">(
    "moderate"
  );
  const [horizon, setHorizon] = useState<"short" | "medium" | "long">("long");
  const [sectors, setSectors] = useState<string[]>([]);

  // Step 3 — preferences
  const [rothTarget, setRothTarget] = useState("7000");
  const [rothYtd, setRothYtd] = useState("0");
  const [coreMin, setCoreMin] = useState("50");

  // Step 4 — confirm
  const [claimLegacy, setClaimLegacy] = useState(false);

  function toggleSector(s: string) {
    setSectors((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function submit() {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          age: age ? Number(age) : undefined,
          annualIncome: income ? Number(income) : undefined,
          occupation,
          riskTolerance: risk,
          timeHorizon: horizon,
          sectorBias: sectors,
          rothIraAnnualTarget: rothTarget ? Number(rothTarget) : undefined,
          rothIraYtdContributed: rothYtd ? Number(rothYtd) : undefined,
          coreAllocationMinPercent: coreMin ? Number(coreMin) : undefined,
          claimLegacyData: claimLegacy,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      router.replace("/");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unexpected error");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      {/* Top bar */}
      <header
        className="flex items-center justify-between h-14 px-6 shrink-0"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-semibold"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent-strong)",
              border: "1px solid var(--border)",
            }}
          >
            ƒ
          </div>
          <span className="text-[14px] font-semibold tracking-tight">Ledger</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
            Step {step} of 4
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[4px] w-6 rounded-full"
                style={{
                  background:
                    i <= step ? "var(--accent)" : "var(--bg-inset)",
                  border: "1px solid var(--border)",
                }}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[640px]">
          {step === 1 && (
            <StepCard
              title="About you"
              subtitle="Just the basics. Everything is editable later in Settings."
            >
              <Row>
                <Field label="Name">
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                  />
                </Field>
                <Field label="Age">
                  <input
                    className="input input-mono"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="25"
                    inputMode="numeric"
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Occupation">
                  <input
                    className="input"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Software engineer"
                  />
                </Field>
                <Field label="Approximate annual income">
                  <input
                    className="input input-mono"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    placeholder="130000"
                    inputMode="numeric"
                  />
                </Field>
              </Row>
            </StepCard>
          )}

          {step === 2 && (
            <StepCard
              title="How do you think about your money?"
              subtitle="Rough strokes. The AI uses this to frame recommendations."
            >
              <Field label="Risk tolerance">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["conservative", "Low volatility"],
                      ["moderate", "Balanced"],
                      ["aggressive", "Growth-led"],
                    ] as const
                  ).map(([key, desc]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRisk(key)}
                      className="card card-hover p-4 text-left"
                      style={{
                        borderColor:
                          risk === key ? "var(--accent)" : "var(--border)",
                        background:
                          risk === key
                            ? "var(--accent-soft)"
                            : "var(--bg-elevated)",
                      }}
                    >
                      <div className="text-[13px] font-semibold capitalize">
                        {key}
                      </div>
                      <div className="text-[11px] text-[color:var(--text-muted)] mt-1">
                        {desc}
                      </div>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Time horizon">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["short", "< 3 years"],
                      ["medium", "3–10 years"],
                      ["long", "10+ years"],
                    ] as const
                  ).map(([key, desc]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setHorizon(key)}
                      className="card card-hover p-4 text-left"
                      style={{
                        borderColor:
                          horizon === key ? "var(--accent)" : "var(--border)",
                        background:
                          horizon === key
                            ? "var(--accent-soft)"
                            : "var(--bg-elevated)",
                      }}
                    >
                      <div className="text-[13px] font-semibold capitalize">
                        {key}
                      </div>
                      <div className="text-[11px] text-[color:var(--text-muted)] mt-1">
                        {desc}
                      </div>
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="Sector interests"
                hint="Tag-select. Influences recommendations; not hard rules."
              >
                <div className="flex flex-wrap gap-1.5">
                  {SECTORS.map((s) => {
                    const on = sectors.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSector(s)}
                        className="chip"
                        style={{
                          borderColor: on
                            ? "var(--accent)"
                            : "var(--border)",
                          background: on
                            ? "var(--accent-soft)"
                            : "var(--bg-inset)",
                          color: on ? "var(--accent-strong)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {on ? "✓" : "+"} {s.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </StepCard>
          )}

          {step === 3 && (
            <StepCard
              title="Contribution + allocation plan"
              subtitle="Tweakable anytime. Sets defaults the AI uses."
            >
              <Row>
                <Field label="Roth IRA 2026 annual target">
                  <input
                    className="input input-mono"
                    value={rothTarget}
                    onChange={(e) => setRothTarget(e.target.value)}
                    placeholder="7000"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Already contributed YTD">
                  <input
                    className="input input-mono"
                    value={rothYtd}
                    onChange={(e) => setRothYtd(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </Field>
              </Row>

              <Field
                label="Core allocation minimum (%)"
                hint="Share of portfolio that should be in broad-market index funds."
              >
                <input
                  className="input input-mono"
                  value={coreMin}
                  onChange={(e) => setCoreMin(e.target.value)}
                  placeholder="50"
                  inputMode="numeric"
                  style={{ maxWidth: 160 }}
                />
              </Field>
            </StepCard>
          )}

          {step === 4 && (
            <StepCard
              title="You're set."
              subtitle="Review, then dive in."
            >
              <div
                className="rounded-md p-4 text-[13px] leading-relaxed"
                style={{
                  background: "var(--bg-inset)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <span className="text-[color:var(--text-muted)]">Name:</span>{" "}
                  {name || "—"}
                </div>
                <div>
                  <span className="text-[color:var(--text-muted)]">
                    Risk profile:
                  </span>{" "}
                  {risk}, {horizon}-term
                </div>
                <div>
                  <span className="text-[color:var(--text-muted)]">
                    Sector bias:
                  </span>{" "}
                  {sectors.length ? sectors.join(", ") : "—"}
                </div>
                <div>
                  <span className="text-[color:var(--text-muted)]">
                    Roth plan:
                  </span>{" "}
                  ${Number(rothTarget || 0).toLocaleString()} / year · $
                  {Number(rothYtd || 0).toLocaleString()} contributed · core min{" "}
                  {coreMin}%
                </div>
              </div>

              <label
                className="mt-5 flex items-start gap-3 p-3 rounded-md cursor-pointer"
                style={{
                  background: "var(--bg-inset)",
                  border: "1px dashed var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  checked={claimLegacy}
                  onChange={(e) => setClaimLegacy(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-[12.5px] font-medium">
                    Claim legacy data
                  </div>
                  <div className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
                    If you&rsquo;re the original single-user owner and there are
                    orphaned rows in the database (from before auth existed),
                    check this to take ownership. Safe to leave off for new
                    accounts.
                  </div>
                </div>
              </label>

              {err && (
                <div
                  className="mt-4 text-[12px] px-3 py-2 rounded"
                  style={{
                    background: "var(--loss-soft)",
                    color: "var(--loss)",
                    border:
                      "1px solid color-mix(in oklab, var(--loss) 40%, transparent)",
                  }}
                >
                  {err}
                </div>
              )}
            </StepCard>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
              disabled={step === 1}
            >
              <ArrowLeft size={14} />
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={step === 1 && !name.trim()}
              >
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Finish"}
                <Check size={14} />
              </button>
            )}
          </div>

          <p className="mt-8 text-center text-[11px] italic text-[color:var(--text-faint)]">
            Informational only — not financial, tax, or legal advice.
          </p>
        </div>
      </main>
    </div>
  );
}

function StepCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-7">
      <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-[13px] text-[color:var(--text-muted)]">
          {subtitle}
        </p>
      )}
      <div className="mt-6 space-y-5">{children}</div>
    </div>
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

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}
