"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Plus, Trash2 } from "lucide-react";
import type { Sector } from "@/lib/types";
import { Card } from "./Pill";

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
];

const SECTOR_LABEL = new Map(SELECTABLE_SECTORS.map((s) => [s.value, s.label]));

export interface CategorizeRow {
  symbol: string;
  name: string;
  currentValue: number;
  savedSector: Sector | null;
  savedCustomCategoryId: string | null;
  cacheSector: Sector | null;
}

export interface CustomCategory {
  id: string;
  name: string;
}

type DraftValue =
  | { kind: "builtin"; sector: Sector }
  | { kind: "custom"; id: string }
  | null;

const NEW_CATEGORY_SENTINEL = "__new_category__";

function encodeDraft(d: DraftValue): string {
  if (!d) return "";
  if (d.kind === "builtin") return `s:${d.sector}`;
  return `c:${d.id}`;
}
function decodeDraft(v: string): DraftValue {
  if (!v) return null;
  if (v.startsWith("s:")) return { kind: "builtin", sector: v.slice(2) as Sector };
  if (v.startsWith("c:")) return { kind: "custom", id: v.slice(2) };
  return null;
}
function sameDraft(a: DraftValue, b: DraftValue): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "builtin" && b.kind === "builtin") return a.sector === b.sector;
  if (a.kind === "custom" && b.kind === "custom") return a.id === b.id;
  return false;
}

function savedFor(row: CategorizeRow): DraftValue {
  if (row.savedCustomCategoryId)
    return { kind: "custom", id: row.savedCustomCategoryId };
  if (row.savedSector) return { kind: "builtin", sector: row.savedSector };
  return null;
}

export function ClassificationReview({
  rows,
  customCategories: initialCategories,
}: {
  rows: CategorizeRow[];
  customCategories: CustomCategory[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<CustomCategory[]>(initialCategories);
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>(() => {
    const init: Record<string, DraftValue> = {};
    for (const r of rows) init[r.symbol] = savedFor(r);
    return init;
  });
  const [saved, setSaved] = useState<Record<string, DraftValue>>(() => {
    const init: Record<string, DraftValue> = {};
    for (const r of rows) init[r.symbol] = savedFor(r);
    return init;
  });
  const [suggested, setSuggested] = useState<Record<string, Sector>>({});
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "uncategorized" | "pending">("all");
  const [newCategoryDraft, setNewCategoryDraft] = useState<string | null>(null);
  const [newCategorySymbol, setNewCategorySymbol] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  const total = useMemo(
    () => rows.reduce((s, r) => s + r.currentValue, 0),
    [rows]
  );
  const uncategorizedCount = useMemo(
    () => rows.filter((r) => !savedFor(r)).length,
    [rows]
  );
  const pendingCount = useMemo(() => {
    let n = 0;
    for (const r of rows) {
      if (!sameDraft(drafts[r.symbol] ?? null, saved[r.symbol] ?? null)) n++;
    }
    return n;
  }, [rows, drafts, saved]);

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "uncategorized") return !saved[r.symbol];
      if (filter === "pending")
        return !sameDraft(drafts[r.symbol] ?? null, saved[r.symbol] ?? null);
      return true;
    });
  }, [rows, filter, drafts, saved]);

  async function suggestAll() {
    setError(null);
    setAiRunning(true);
    try {
      // Only suggest for rows that don't already have a saved override.
      const targets = rows.filter((r) => !saved[r.symbol]).map((r) => r.symbol);
      if (targets.length === 0) {
        setAiRunning(false);
        return;
      }
      const res = await fetch("/api/classify/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbols: targets }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      const { suggestions } = (await res.json()) as {
        suggestions: { symbol: string; sector: Sector }[];
      };
      const nextSuggested = { ...suggested };
      const nextDrafts = { ...drafts };
      for (const s of suggestions) {
        nextSuggested[s.symbol] = s.sector;
        // Only overwrite draft if row has no saved override and user hasn't
        // already picked something manually.
        if (!saved[s.symbol] && !drafts[s.symbol]) {
          nextDrafts[s.symbol] = { kind: "builtin", sector: s.sector };
        }
      }
      setSuggested(nextSuggested);
      setDrafts(nextDrafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI classification failed");
    } finally {
      setAiRunning(false);
    }
  }

  async function saveRow(symbol: string) {
    const draft = drafts[symbol];
    if (!draft) return;
    setError(null);
    setSavingSymbol(symbol);
    try {
      const res = await fetch("/api/classify/override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol,
          sector: draft.kind === "builtin" ? draft.sector : "other",
          customCategoryId: draft.kind === "custom" ? draft.id : null,
          recomputeAnalysis: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      setSaved((prev) => ({ ...prev, [symbol]: draft }));
      setSuggested((prev) => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSymbol(null);
    }
  }

  async function saveAllPending() {
    const items: Array<{
      symbol: string;
      sector: Sector;
      customCategoryId: string | null;
    }> = [];
    for (const r of rows) {
      const d = drafts[r.symbol];
      if (!d) continue;
      if (sameDraft(d, saved[r.symbol] ?? null)) continue;
      items.push({
        symbol: r.symbol,
        sector: d.kind === "builtin" ? d.sector : "other",
        customCategoryId: d.kind === "custom" ? d.id : null,
      });
    }
    if (items.length === 0) return;
    setError(null);
    setBulkSaving(true);
    try {
      const res = await fetch("/api/classify/override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items, recomputeAnalysis: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      const nextSaved = { ...saved };
      const nextSuggested = { ...suggested };
      for (const item of items) {
        nextSaved[item.symbol] = item.customCategoryId
          ? { kind: "custom", id: item.customCategoryId }
          : { kind: "builtin", sector: item.sector };
        delete nextSuggested[item.symbol];
      }
      setSaved(nextSaved);
      setSuggested(nextSuggested);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk save failed");
    } finally {
      setBulkSaving(false);
    }
  }

  function onDropdownChange(symbol: string, value: string) {
    if (value === NEW_CATEGORY_SENTINEL) {
      setNewCategorySymbol(symbol);
      setNewCategoryDraft("");
      return;
    }
    setDrafts((prev) => ({ ...prev, [symbol]: decodeDraft(value) }));
  }

  async function createCategory() {
    if (!newCategoryDraft || !newCategorySymbol) return;
    const name = newCategoryDraft.trim();
    if (!name) return;
    setError(null);
    setSavingCategory(true);
    try {
      const res = await fetch("/api/classify/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      const { category } = (await res.json()) as { category: CustomCategory };
      setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
      setDrafts((prev) => ({
        ...prev,
        [newCategorySymbol]: { kind: "custom", id: category.id },
      }));
      setNewCategoryDraft(null);
      setNewCategorySymbol(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create category failed");
    } finally {
      setSavingCategory(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category? Holdings assigned to it will revert to their sector.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/classify/categories?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      setCategories((prev) => prev.filter((c) => c.id !== id));
      // Clear drafts and saved state that referenced this category.
      setDrafts((prev) => {
        const next = { ...prev };
        for (const [sym, d] of Object.entries(next)) {
          if (d?.kind === "custom" && d.id === id) next[sym] = null;
        }
        return next;
      });
      setSaved((prev) => {
        const next = { ...prev };
        for (const [sym, d] of Object.entries(next)) {
          if (d?.kind === "custom" && d.id === id) next[sym] = null;
        }
        return next;
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (rows.length === 0) return null;

  return (
    <Card className="mb-6">
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="text-[14px] font-semibold">Categorize holdings</h3>
          <p className="text-[12px] text-[color:var(--text-muted)] mt-1">
            {rows.length} position{rows.length === 1 ? "" : "s"} ·{" "}
            <span className="mono">${Math.round(total).toLocaleString()}</span>
            {uncategorizedCount > 0 && (
              <>
                {" "}
                ·{" "}
                <span style={{ color: "var(--warn, var(--text))" }}>
                  {uncategorizedCount} uncategorized
                </span>
              </>
            )}
            {pendingCount > 0 && (
              <>
                {" "}
                ·{" "}
                <span style={{ color: "var(--accent)" }}>
                  {pendingCount} pending
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="text-[12px] px-2 py-1.5 rounded"
            style={{
              background: "var(--bg-inset)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            <option value="all">All</option>
            <option value="uncategorized">Uncategorized</option>
            <option value="pending">Pending</option>
          </select>
          <button
            type="button"
            onClick={suggestAll}
            disabled={aiRunning || uncategorizedCount === 0}
            className="btn btn-sm"
            title={uncategorizedCount === 0 ? "Nothing uncategorized" : undefined}
          >
            {aiRunning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {aiRunning ? "Suggesting…" : "Suggest with AI"}
          </button>
          <button
            type="button"
            onClick={saveAllPending}
            disabled={bulkSaving || pendingCount === 0}
            className="btn btn-sm btn-primary"
          >
            {bulkSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            {bulkSaving ? "Saving…" : `Save all (${pendingCount})`}
          </button>
        </div>
      </div>

      {categories.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 mb-3 pb-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="text-[11px] text-[color:var(--text-muted)] self-center mr-1">
            Your categories:
          </span>
          {categories.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded"
              style={{
                background: "var(--bg-inset)",
                border: "1px solid var(--border)",
              }}
            >
              {c.name}
              <button
                type="button"
                onClick={() => deleteCategory(c.id)}
                className="opacity-60 hover:opacity-100"
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div
          className="text-[12px] mb-3 px-3 py-2 rounded"
          style={{ background: "var(--bg-inset)", color: "var(--loss)" }}
        >
          {error}
        </div>
      )}

      {newCategoryDraft !== null && newCategorySymbol !== null && (
        <div
          className="flex items-center gap-2 mb-3 px-3 py-2 rounded"
          style={{ background: "var(--bg-inset)" }}
        >
          <span className="text-[12px]">New category for {newCategorySymbol}:</span>
          <input
            autoFocus
            value={newCategoryDraft}
            onChange={(e) => setNewCategoryDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createCategory();
              if (e.key === "Escape") {
                setNewCategoryDraft(null);
                setNewCategorySymbol(null);
              }
            }}
            placeholder="e.g. Cash Equivalents"
            className="text-[12px] px-2 py-1 rounded flex-1"
            style={{
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          />
          <button
            type="button"
            onClick={createCategory}
            disabled={savingCategory || !newCategoryDraft.trim()}
            className="btn btn-sm btn-primary"
          >
            {savingCategory ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setNewCategoryDraft(null);
              setNewCategorySymbol(null);
            }}
            className="btn btn-sm"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
        {visible.map((row) => {
          const draft = drafts[row.symbol] ?? null;
          const savedVal = saved[row.symbol] ?? null;
          const dirty = !sameDraft(draft, savedVal);
          const saving = savingSymbol === row.symbol;
          const sourcePill = (() => {
            if (savedVal?.kind === "custom") {
              const cat = categories.find((c) => c.id === savedVal.id);
              return cat ? `Manual · ${cat.name}` : "Manual";
            }
            if (savedVal) return "Manual";
            if (suggested[row.symbol]) return "AI suggestion";
            if (row.cacheSector) return "AI";
            return "Uncategorized";
          })();
          return (
            <div
              key={row.symbol}
              className="flex items-center gap-3 py-2 px-2 rounded"
              style={{ background: dirty ? "var(--bg-inset)" : "transparent" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">
                  <span className="mono">{row.symbol}</span>
                  <span className="text-[color:var(--text-muted)] ml-2 font-normal">
                    {row.name}
                  </span>
                </div>
                <div className="text-[11px] text-[color:var(--text-faint)] mt-0.5 flex items-center gap-2">
                  <span className="mono">
                    ${Math.round(row.currentValue).toLocaleString()}
                  </span>
                  <span>·</span>
                  <span>{sourcePill}</span>
                </div>
              </div>
              <select
                value={encodeDraft(draft)}
                onChange={(e) => onDropdownChange(row.symbol, e.target.value)}
                disabled={saving}
                className="text-[12px] px-2 py-1.5 rounded"
                style={{
                  background: "var(--bg-inset)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  minWidth: 200,
                }}
              >
                <option value="">Select category…</option>
                <optgroup label="Built-in sectors">
                  {SELECTABLE_SECTORS.map((s) => (
                    <option key={s.value} value={`s:${s.value}`}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                {categories.length > 0 && (
                  <optgroup label="Your categories">
                    {categories.map((c) => (
                      <option key={c.id} value={`c:${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value={NEW_CATEGORY_SENTINEL}>+ New category…</option>
              </select>
              <button
                type="button"
                onClick={() => saveRow(row.symbol)}
                disabled={!dirty || saving || !draft}
                className="btn btn-sm"
                style={{ minWidth: 74 }}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : "Save"}
              </button>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="text-[12px] text-[color:var(--text-muted)] py-4 text-center">
            No rows match this filter.
          </div>
        )}
      </div>
    </Card>
  );
}

// Helper used by the page to render sector labels consistently.
export function builtinSectorLabel(sector: Sector): string {
  return SECTOR_LABEL.get(sector) ?? sector;
}
