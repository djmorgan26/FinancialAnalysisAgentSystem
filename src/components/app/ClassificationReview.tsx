"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, Loader2 } from "lucide-react";
import type { Sector } from "@/lib/types";
import { Card } from "./Pill";

// Keep the list in sync with src/lib/classification/index.ts SECTORS, but
// filter out "other" from the selectable options (it's the default/unknown
// state — no point letting users pick it as an override).
const SELECTABLE_SECTORS: { value: Sector; label: string }[] = [
  { value: "broad_market", label: "Broad Market" },
  { value: "technology", label: "Technology" },
  { value: "semiconductors", label: "Semiconductors" },
  { value: "ai_ml", label: "AI / Machine Learning" },
  { value: "quantum_computing", label: "Quantum Computing" },
  { value: "biotech", label: "Biotech" },
  { value: "healthcare", label: "Healthcare" },
  { value: "financials", label: "Financials" },
  { value: "consumer_discretionary", label: "Consumer Discretionary" },
  { value: "consumer_staples", label: "Consumer Staples" },
  { value: "industrials", label: "Industrials" },
  { value: "energy", label: "Energy" },
  { value: "utilities", label: "Utilities" },
  { value: "materials", label: "Materials" },
  { value: "real_estate", label: "Real Estate" },
  { value: "communication_services", label: "Communication Services" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "other", label: "Other" },
];

export interface UnclassifiedRow {
  symbol: string;
  name: string;
  currentValue: number;
  currentSector: Sector;
}

export function ClassificationReview({
  unclassified,
}: {
  unclassified: UnclassifiedRow[];
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, Sector>>({});
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
  const [savedSymbols, setSavedSymbols] = useState<Set<string>>(new Set());
  const [aiRunning, setAiRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => unclassified.reduce((s, r) => s + r.currentValue, 0),
    [unclassified]
  );

  if (unclassified.length === 0) return null;

  async function suggestAll() {
    setError(null);
    setAiRunning(true);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: unclassified.map((r) => r.symbol),
          recomputeAnalysis: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI classification failed");
    } finally {
      setAiRunning(false);
    }
  }

  async function saveOverride(symbol: string) {
    const sector = selections[symbol];
    if (!sector) return;
    setError(null);
    setSavingSymbol(symbol);
    try {
      const res = await fetch("/api/classify/override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol, sector, recomputeAnalysis: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      setSavedSymbols((prev) => new Set(prev).add(symbol));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSymbol(null);
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="text-[14px] font-semibold">
            Categorize holdings ({unclassified.length})
          </h3>
          <p className="text-[12px] text-[color:var(--text-muted)] mt-1">
            These positions ({" "}
            <span className="mono">${Math.round(total).toLocaleString()}</span>{" "}
            ) are in the &ldquo;Other&rdquo; sector. Let AI suggest or pick
            manually — changes update sector exposure immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={suggestAll}
          disabled={aiRunning}
          className="btn btn-sm btn-primary whitespace-nowrap"
        >
          {aiRunning ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {aiRunning ? "Classifying…" : "Suggest with AI"}
        </button>
      </div>

      {error && (
        <div
          className="text-[12px] mb-3 px-3 py-2 rounded"
          style={{ background: "var(--bg-inset)", color: "var(--loss)" }}
        >
          {error}
        </div>
      )}

      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
        {unclassified.map((row) => {
          const saved = savedSymbols.has(row.symbol);
          const saving = savingSymbol === row.symbol;
          const selected = selections[row.symbol] ?? "";
          return (
            <div
              key={row.symbol}
              className="flex items-center gap-3 py-2 px-2 rounded"
              style={{
                background: saved ? "var(--bg-inset)" : "transparent",
                opacity: saved ? 0.75 : 1,
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">
                  <span className="mono">{row.symbol}</span>
                  <span className="text-[color:var(--text-muted)] ml-2 font-normal">
                    {row.name}
                  </span>
                </div>
                <div className="text-[11px] text-[color:var(--text-faint)] mono mt-0.5">
                  ${Math.round(row.currentValue).toLocaleString()}
                </div>
              </div>
              <select
                value={selected}
                onChange={(e) =>
                  setSelections((prev) => ({
                    ...prev,
                    [row.symbol]: e.target.value as Sector,
                  }))
                }
                disabled={saving || saved}
                className="text-[12px] px-2 py-1.5 rounded"
                style={{
                  background: "var(--bg-inset)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  minWidth: 180,
                }}
              >
                <option value="">Select sector…</option>
                {SELECTABLE_SECTORS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => saveOverride(row.symbol)}
                disabled={!selected || saving || saved}
                className="btn btn-sm"
                style={{ minWidth: 74 }}
              >
                {saved ? (
                  <>
                    <Check size={13} />
                    Saved
                  </>
                ) : saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
