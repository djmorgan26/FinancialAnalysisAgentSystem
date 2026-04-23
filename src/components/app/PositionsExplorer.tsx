"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import type { Account, Holding } from "@/lib/types";

type ViewMode = "asset" | "account";
type SortKey = "symbol" | "name" | "quantity" | "value" | "gainLossPercent" | "price";
type SortDir = "asc" | "desc";

export type PositionsExplorerProps = {
  holdings: Holding[];
  accounts: Account[];
  /** Cap rows rendered (per-mode). Omit to render all. */
  limit?: number;
  /** Shown when there are no holdings at all. */
  emptyMessage?: string;
};

type AggregatedAsset = {
  symbol: string;
  name: string;
  quantity: number;
  costBasis: number;
  currentValue: number;
  currentPrice: number;
  gainLoss: number;
  gainLossPercent: number;
  assetClass: Holding["assetClass"];
  sector: Holding["sector"];
  accountIds: string[];
  lots: Holding[];
};

const ASSET_CLASS_LABELS: Record<Holding["assetClass"], string> = {
  us_equity: "US equity",
  intl_equity: "Intl equity",
  fixed_income: "Fixed income",
  cash: "Cash",
  crypto: "Crypto",
  commodity: "Commodity",
  real_estate: "Real estate",
  other: "Other",
};

function aggregate(holdings: Holding[]): AggregatedAsset[] {
  const map = new Map<string, AggregatedAsset>();
  for (const h of holdings) {
    const key = h.symbol || h.name || h.id;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += h.quantity;
      existing.costBasis += h.costBasis;
      existing.currentValue += h.currentValue;
      if (!existing.accountIds.includes(h.accountId))
        existing.accountIds.push(h.accountId);
      existing.lots.push(h);
    } else {
      map.set(key, {
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        costBasis: h.costBasis,
        currentValue: h.currentValue,
        currentPrice: h.currentPrice,
        gainLoss: 0,
        gainLossPercent: 0,
        assetClass: h.assetClass,
        sector: h.sector,
        accountIds: [h.accountId],
        lots: [h],
      });
    }
  }
  for (const a of map.values()) {
    a.gainLoss = a.currentValue - a.costBasis;
    a.gainLossPercent = a.costBasis > 0 ? (a.gainLoss / a.costBasis) * 100 : 0;
  }
  return [...map.values()];
}

function compare(a: number | string, b: number | string, dir: SortDir) {
  if (typeof a === "number" && typeof b === "number") {
    return dir === "asc" ? a - b : b - a;
  }
  const as = String(a).toLowerCase();
  const bs = String(b).toLowerCase();
  if (as < bs) return dir === "asc" ? -1 : 1;
  if (as > bs) return dir === "asc" ? 1 : -1;
  return 0;
}

export function PositionsExplorer({
  holdings,
  accounts,
  limit,
  emptyMessage = "No holdings yet. Connect an account to get started.",
}: PositionsExplorerProps) {
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get("q") ?? "";
  const [mode, setMode] = useState<ViewMode>("asset");
  const [search, setSearch] = useState(initialQ);

  useEffect(() => {
    // Keep input in sync if the URL `?q=` changes (e.g. navigating between
    // two different holdings from QuickSearch without a full reload).
    if (initialQ !== search && initialQ !== "") {
      setSearch(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);
  const [selectedClasses, setSelectedClasses] = useState<Set<Holding["assetClass"]>>(new Set());
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const accountMap = useMemo(() => {
    const m = new Map<string, Account>();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  const presentClasses = useMemo(() => {
    const s = new Set<Holding["assetClass"]>();
    for (const h of holdings) s.add(h.assetClass);
    return [...s];
  }, [holdings]);

  const presentAccounts = useMemo(() => {
    const ids = new Set<string>();
    for (const h of holdings) ids.add(h.accountId);
    return accounts.filter((a) => ids.has(a.id));
  }, [holdings, accounts]);

  const filteredHoldings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return holdings.filter((h) => {
      if (selectedClasses.size > 0 && !selectedClasses.has(h.assetClass)) return false;
      if (selectedAccounts.size > 0 && !selectedAccounts.has(h.accountId)) return false;
      if (q && !h.symbol.toLowerCase().includes(q) && !(h.name ?? "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [holdings, search, selectedClasses, selectedAccounts]);

  const assetRows = useMemo(() => {
    if (mode !== "asset") return [];
    const rows = aggregate(filteredHoldings);
    const sortFieldOf = (r: AggregatedAsset) => {
      switch (sortKey) {
        case "symbol": return r.symbol;
        case "name": return r.name || r.symbol;
        case "quantity": return r.quantity;
        case "value": return r.currentValue;
        case "gainLossPercent": return r.gainLossPercent;
        case "price": return r.currentPrice;
      }
    };
    rows.sort((a, b) => compare(sortFieldOf(a), sortFieldOf(b), sortDir));
    return rows;
  }, [filteredHoldings, mode, sortKey, sortDir]);

  const lotRows = useMemo(() => {
    if (mode !== "account") return [];
    const rows = [...filteredHoldings];
    const sortFieldOf = (h: Holding) => {
      switch (sortKey) {
        case "symbol": return h.symbol;
        case "name": return h.name || h.symbol;
        case "quantity": return h.quantity;
        case "value": return h.currentValue;
        case "gainLossPercent": return h.gainLossPercent;
        case "price": return h.currentPrice;
      }
    };
    rows.sort((a, b) => compare(sortFieldOf(a), sortFieldOf(b), sortDir));
    return rows;
  }, [filteredHoldings, mode, sortKey, sortDir]);

  const totalValue = filteredHoldings.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = filteredHoldings.reduce((s, h) => s + h.costBasis, 0);
  const totalGL = totalValue - totalCost;
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
  const uniqueSymbols = new Set(filteredHoldings.map((h) => h.symbol)).size;

  const anyFilter =
    search !== "" || selectedClasses.size > 0 || selectedAccounts.size > 0;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" || key === "name" ? "asc" : "desc");
    }
  }

  function toggleClass(c: Holding["assetClass"]) {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setSelectedClasses(new Set());
    setSelectedAccounts(new Set());
  }

  const assetGrid = "24px 80px 1.4fr 90px 90px 100px 110px 80px 90px";
  const lotGrid = "70px 1.3fr 1fr 80px 90px 100px 110px 80px";

  const cappedAssets = limit ? assetRows.slice(0, limit) : assetRows;
  const cappedLots = limit ? lotRows.slice(0, limit) : lotRows;

  return (
    <div className="card" style={{ padding: 0 }}>
      {/* Toolbar */}
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[14px] font-semibold">Positions</h3>
            <div
              className="flex items-center rounded-md overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <button
                type="button"
                onClick={() => setMode("asset")}
                className="px-3 py-1 text-[11.5px]"
                style={{
                  background: mode === "asset" ? "var(--accent-soft)" : "transparent",
                  color: mode === "asset" ? "var(--accent-strong)" : "var(--text-muted)",
                  fontWeight: mode === "asset" ? 600 : 400,
                }}
              >
                By asset
              </button>
              <button
                type="button"
                onClick={() => setMode("account")}
                className="px-3 py-1 text-[11.5px]"
                style={{
                  background: mode === "account" ? "var(--accent-soft)" : "transparent",
                  color: mode === "account" ? "var(--accent-strong)" : "var(--text-muted)",
                  fontWeight: mode === "account" ? 600 : 400,
                  borderLeft: "1px solid var(--border)",
                }}
              >
                By account
              </button>
            </div>
          </div>
          <div className="text-[11px] text-[color:var(--text-muted)]">
            {mode === "asset" ? (
              <>
                {cappedAssets.length} of {assetRows.length} assets · {uniqueSymbols} unique symbols
              </>
            ) : (
              <>
                {cappedLots.length} of {lotRows.length} lots
              </>
            )}
            {" · "}
            <span className="mono text-[color:var(--text)]">
              ${Math.round(totalValue).toLocaleString()}
            </span>
            {totalCost > 0 && (
              <>
                {" · "}
                <span
                  className="mono"
                  style={{
                    color:
                      totalGL > 0
                        ? "var(--gain)"
                        : totalGL < 0
                          ? "var(--loss)"
                          : "var(--text-muted)",
                  }}
                >
                  {totalGL > 0 ? "+" : ""}
                  {totalGLPct.toFixed(1)}%
                </span>
              </>
            )}
          </div>
        </div>

        {/* Search + filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-1.5 rounded-md px-2 py-1"
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg-inset)",
              minWidth: 200,
            }}
          >
            <Search size={13} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search symbol or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-[12px] flex-1"
              style={{ color: "var(--text)" }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ color: "var(--text-muted)" }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {presentClasses.map((c) => {
            const on = selectedClasses.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleClass(c)}
                className="chip"
                style={{
                  background: on ? "var(--accent-soft)" : "transparent",
                  color: on ? "var(--accent-strong)" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                  fontWeight: on ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {ASSET_CLASS_LABELS[c] ?? c}
              </button>
            );
          })}

          {presentAccounts.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-faint)] ml-1">
                Accounts
              </span>
              {presentAccounts.map((a) => {
                const on = selectedAccounts.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAccount(a.id)}
                    className="chip"
                    style={{
                      background: on ? "var(--accent-soft)" : "transparent",
                      color: on ? "var(--accent-strong)" : "var(--text-muted)",
                      border: "1px solid var(--border)",
                      fontWeight: on ? 600 : 400,
                      cursor: "pointer",
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={a.name}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
          )}

          {anyFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px]"
              style={{ color: "var(--text-muted)", textDecoration: "underline" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {holdings.length === 0 ? (
        <div className="px-5 py-10 text-center text-[12px] text-[color:var(--text-muted)]">
          {emptyMessage}
        </div>
      ) : (mode === "asset" ? cappedAssets.length : cappedLots.length) === 0 ? (
        <div className="px-5 py-10 text-center text-[12px] text-[color:var(--text-muted)]">
          No positions match your filters.
        </div>
      ) : mode === "asset" ? (
        <>
          <HeaderRow
            grid={assetGrid}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            cols={[
              { key: null, label: "" },
              { key: "symbol", label: "Symbol" },
              { key: "name", label: "Name" },
              { key: "quantity", label: "Qty", align: "right" },
              { key: "price", label: "Price", align: "right" },
              { key: "value", label: "Value", align: "right" },
              { key: null, label: "Cost / Avg", align: "right" },
              { key: "gainLossPercent", label: "G/L %", align: "right" },
              { key: null, label: "Accounts", align: "right" },
            ]}
          />
          {cappedAssets.map((r) => {
            const key = r.symbol || r.name;
            const isOpen = expanded.has(key);
            const avgCost = r.quantity > 0 ? r.costBasis / r.quantity : 0;
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => r.lots.length > 1 && toggleExpanded(key)}
                  className="grid px-5 py-2.5 text-[12.5px] items-center w-full text-left"
                  style={{
                    gridTemplateColumns: assetGrid,
                    borderBottom: "1px dotted var(--border)",
                    cursor: r.lots.length > 1 ? "pointer" : "default",
                  }}
                >
                  <div style={{ color: "var(--text-muted)" }}>
                    {r.lots.length > 1 ? (
                      isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                    ) : null}
                  </div>
                  <div className="mono font-semibold">{r.symbol || "—"}</div>
                  <div className="truncate" style={{ color: "var(--text-muted)" }}>
                    {r.name || "—"}
                  </div>
                  <div className="mono text-right">{r.quantity.toFixed(r.quantity < 1 ? 6 : 2)}</div>
                  <div className="mono text-right" style={{ color: "var(--text-muted)" }}>
                    ${r.currentPrice.toFixed(2)}
                  </div>
                  <div className="mono text-right font-medium">
                    ${Math.round(r.currentValue).toLocaleString()}
                  </div>
                  <div
                    className="mono text-right text-[11.5px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ${Math.round(r.costBasis).toLocaleString()}
                    <span style={{ color: "var(--text-faint)" }}> · ${avgCost.toFixed(2)}</span>
                  </div>
                  <div
                    className="mono text-right"
                    style={{
                      color:
                        r.gainLossPercent > 0
                          ? "var(--gain)"
                          : r.gainLossPercent < 0
                            ? "var(--loss)"
                            : "var(--text-muted)",
                    }}
                  >
                    {r.gainLossPercent > 0 ? "+" : ""}
                    {r.gainLossPercent.toFixed(1)}%
                  </div>
                  <div
                    className="text-right text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {r.accountIds.length === 1
                      ? (accountMap.get(r.accountIds[0])?.name ?? "—")
                      : `${r.accountIds.length} accounts`}
                  </div>
                </button>
                {isOpen &&
                  r.lots.map((lot) => {
                    const acct = accountMap.get(lot.accountId);
                    return (
                      <div
                        key={lot.id}
                        className="grid px-5 py-2 text-[11.5px] items-center"
                        style={{
                          gridTemplateColumns: assetGrid,
                          borderBottom: "1px dotted var(--border)",
                          background: "var(--bg-inset)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <div />
                        <div />
                        <div className="truncate pl-2" style={{ borderLeft: "2px solid var(--border)" }}>
                          ↳ {acct?.name ?? "—"}
                          {acct?.platform ? (
                            <span style={{ color: "var(--text-faint)" }}> · {acct.platform}</span>
                          ) : null}
                        </div>
                        <div className="mono text-right">
                          {lot.quantity.toFixed(lot.quantity < 1 ? 6 : 2)}
                        </div>
                        <div className="mono text-right">${lot.currentPrice.toFixed(2)}</div>
                        <div className="mono text-right">
                          ${Math.round(lot.currentValue).toLocaleString()}
                        </div>
                        <div className="mono text-right">
                          ${Math.round(lot.costBasis).toLocaleString()}
                        </div>
                        <div
                          className="mono text-right"
                          style={{
                            color:
                              lot.gainLossPercent > 0
                                ? "var(--gain)"
                                : lot.gainLossPercent < 0
                                  ? "var(--loss)"
                                  : "var(--text-muted)",
                          }}
                        >
                          {lot.gainLossPercent > 0 ? "+" : ""}
                          {lot.gainLossPercent.toFixed(1)}%
                        </div>
                        <div />
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </>
      ) : (
        <>
          <HeaderRow
            grid={lotGrid}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            cols={[
              { key: "symbol", label: "Symbol" },
              { key: "name", label: "Name" },
              { key: null, label: "Account" },
              { key: "quantity", label: "Qty", align: "right" },
              { key: "price", label: "Price", align: "right" },
              { key: "value", label: "Value", align: "right" },
              { key: null, label: "Cost / Avg", align: "right" },
              { key: "gainLossPercent", label: "G/L %", align: "right" },
            ]}
          />
          {cappedLots.map((h) => {
            const acct = accountMap.get(h.accountId);
            const avg = h.quantity > 0 ? h.costBasis / h.quantity : 0;
            return (
              <div
                key={h.id}
                className="grid px-5 py-2 text-[12.5px] items-center"
                style={{
                  gridTemplateColumns: lotGrid,
                  borderBottom: "1px dotted var(--border)",
                }}
              >
                <div className="mono font-semibold">{h.symbol || "—"}</div>
                <div className="truncate" style={{ color: "var(--text-muted)" }}>
                  {h.name || "—"}
                </div>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {acct?.name ?? "—"}
                </div>
                <div className="mono text-right">{h.quantity.toFixed(h.quantity < 1 ? 6 : 2)}</div>
                <div className="mono text-right" style={{ color: "var(--text-muted)" }}>
                  ${h.currentPrice.toFixed(2)}
                </div>
                <div className="mono text-right font-medium">
                  ${Math.round(h.currentValue).toLocaleString()}
                </div>
                <div className="mono text-right text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                  ${Math.round(h.costBasis).toLocaleString()}
                  <span style={{ color: "var(--text-faint)" }}> · ${avg.toFixed(2)}</span>
                </div>
                <div
                  className="mono text-right"
                  style={{
                    color:
                      h.gainLossPercent > 0
                        ? "var(--gain)"
                        : h.gainLossPercent < 0
                          ? "var(--loss)"
                          : "var(--text-muted)",
                  }}
                >
                  {h.gainLossPercent > 0 ? "+" : ""}
                  {h.gainLossPercent.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function HeaderRow({
  grid,
  cols,
  sortKey,
  sortDir,
  onSort,
}: {
  grid: string;
  cols: { key: SortKey | null; label: string; align?: "left" | "right" }[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  return (
    <div
      className="grid text-[10px] uppercase tracking-wider px-5 py-2 sticky top-0 z-10"
      style={{
        gridTemplateColumns: grid,
        color: "var(--text-muted)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
      }}
    >
      {cols.map((c, i) => {
        const active = c.key != null && c.key === sortKey;
        const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "";
        if (c.key == null) {
          return (
            <div key={i} className={c.align === "right" ? "text-right" : ""}>
              {c.label}
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSort(c.key as SortKey)}
            className={c.align === "right" ? "text-right" : "text-left"}
            style={{
              color: active ? "var(--text)" : "var(--text-muted)",
              cursor: "pointer",
              fontWeight: active ? 600 : 400,
            }}
          >
            {c.label}
            {arrow && <span className="ml-1">{arrow}</span>}
          </button>
        );
      })}
    </div>
  );
}
