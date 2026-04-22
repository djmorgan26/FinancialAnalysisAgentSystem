"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Upload, Link as LinkIcon, X } from "lucide-react";
import { Card, StatusBadge } from "@/components/app/Pill";

type ConnectionState =
  | "connected"
  | "csv-fresh"
  | "csv-stale"
  | "error"
  | "not-set-up"
  | "coming-soon";

interface ConnectionsResponse {
  schwab: {
    configured: boolean;
    connected?: boolean;
    needsReauth?: boolean;
    expiresAt?: string | null;
    authUrl?: string | null;
  };
  finnhub: { configured: boolean; connected: boolean };
  coinbase: { configured: boolean; connected: boolean };
  csv: { fidelity: string | null; robinhood: string | null };
}

export function ConnectionsClient() {
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [uploadPlatform, setUploadPlatform] = useState<
    "fidelity" | "robinhood" | null
  >(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/connections", { cache: "no-store" });
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function syncSchwab() {
    setSyncing("schwab");
    try {
      const res = await fetch("/api/schwab", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        if (body.authUrl) {
          window.location.href = body.authUrl;
          return;
        }
        setToast(`Schwab: ${body.error}`);
      } else {
        setToast(
          `Schwab synced: ${body.accountCount} accounts, ${body.positionCount} positions`
        );
      }
    } finally {
      setSyncing(null);
      load();
    }
  }

  async function syncCoinbase() {
    setSyncing("coinbase");
    try {
      const res = await fetch("/api/coinbase", { method: "POST" });
      const body = await res.json();
      setToast(
        res.ok
          ? `Coinbase synced: ${body.positionCount} crypto positions`
          : `Coinbase: ${body.error}`
      );
    } finally {
      setSyncing(null);
      load();
    }
  }

  function connectSchwab() {
    if (data?.schwab.authUrl) {
      window.location.href = data.schwab.authUrl;
    }
  }

  if (loading) return <LoadingCards />;
  if (!data) return <div>Failed to load connections.</div>;

  const schwabState: ConnectionState = !data.schwab.configured
    ? "not-set-up"
    : data.schwab.connected
      ? "connected"
      : "error";

  const coinbaseState: ConnectionState = !data.coinbase.configured
    ? "not-set-up"
    : data.coinbase.connected
      ? "connected"
      : "error";

  const finnhubState: ConnectionState = data.finnhub.configured
    ? "connected"
    : "not-set-up";

  function csvFreshness(ts: string | null): ConnectionState {
    if (!ts) return "not-set-up";
    const ageDays = (Date.now() - new Date(ts).getTime()) / 86_400_000;
    return ageDays > 7 ? "csv-stale" : "csv-fresh";
  }

  const fidelityState = csvFreshness(data.csv.fidelity);
  const robinhoodState = csvFreshness(data.csv.robinhood);

  return (
    <>
      {toast && (
        <div
          className="mb-4 px-4 py-3 rounded text-[13px]"
          style={{
            background: "var(--info-soft)",
            color: "var(--info)",
            border: "1px solid color-mix(in oklab, var(--info) 40%, transparent)",
          }}
        >
          {toast}
        </div>
      )}

      <div className="flex items-center justify-end mb-4">
        <button className="btn btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <SectionHeader
        title="Connected · live"
        subtitle="Active APIs, live data"
      />
      <div className="grid md:grid-cols-2 gap-3 mb-6">
        <ConnCard
          name="Charles Schwab"
          accounts="Individual, Roth IRA — OAuth · live"
          meta={
            data.schwab.configured
              ? data.schwab.connected
                ? `Token valid${data.schwab.expiresAt ? ` until ${new Date(data.schwab.expiresAt).toLocaleDateString()}` : ""}`
                : "Token expired — reauth needed (7-day Schwab limit)"
              : "Add SCHWAB_APP_KEY + SCHWAB_APP_SECRET to enable"
          }
          state={schwabState}
          actions={
            <>
              {schwabState === "connected" && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={syncSchwab}
                  disabled={syncing === "schwab"}
                >
                  <RefreshCw
                    size={13}
                    className={syncing === "schwab" ? "animate-spin" : ""}
                  />
                  Sync now
                </button>
              )}
              {schwabState === "error" && (
                <button className="btn btn-sm btn-primary" onClick={connectSchwab}>
                  <LinkIcon size={13} />
                  Reauthenticate
                </button>
              )}
              {schwabState === "not-set-up" && (
                <button className="btn btn-sm" disabled>
                  Not configured
                </button>
              )}
            </>
          }
        />

        <ConnCard
          name="Coinbase"
          accounts="Crypto wallets · read-only"
          meta={
            data.coinbase.configured
              ? data.coinbase.connected
                ? "CDP API key · live"
                : "API key rejected — double-check it in .env.local"
              : "Add COINBASE_API_KEY + COINBASE_API_SECRET to enable"
          }
          state={coinbaseState}
          actions={
            data.coinbase.connected ? (
              <button
                className="btn btn-sm btn-primary"
                onClick={syncCoinbase}
                disabled={syncing === "coinbase"}
              >
                <RefreshCw
                  size={13}
                  className={syncing === "coinbase" ? "animate-spin" : ""}
                />
                Sync now
              </button>
            ) : null
          }
        />

        <ConnCard
          name="Finnhub"
          accounts="Market data — quotes, news"
          meta={
            data.finnhub.configured
              ? "Free tier · global key"
              : "Add FINNHUB_API_KEY to enable live quotes"
          }
          state={finnhubState}
        />
      </div>

      <SectionHeader
        title="CSV-based"
        subtitle="Manual export + upload. Honest about freshness."
      />
      <div className="grid md:grid-cols-2 gap-3 mb-6">
        <ConnCard
          name="Fidelity"
          accounts="401(k), BrokerageLink"
          meta={
            data.csv.fidelity
              ? `Last imported ${relTime(data.csv.fidelity)}`
              : "No CSV imported yet"
          }
          state={fidelityState}
          actions={
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setUploadPlatform("fidelity")}
            >
              <Upload size={13} /> Upload CSV
            </button>
          }
        />

        <ConnCard
          name="Robinhood"
          accounts="Brokerage"
          meta={
            data.csv.robinhood
              ? `Last imported ${relTime(data.csv.robinhood)}`
              : "No CSV imported yet"
          }
          state={robinhoodState}
          actions={
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setUploadPlatform("robinhood")}
            >
              <Upload size={13} /> Upload CSV
            </button>
          }
        />
      </div>

      <SectionHeader
        title="Coming soon"
        subtitle="Planned. Not yet available."
      />
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        {["Chase", "Citi", "Bank checking/savings"].map((n) => (
          <ConnCard
            key={n}
            name={n}
            accounts="Credit card / checking"
            meta="Evaluating Plaid for secure aggregation"
            state="coming-soon"
          />
        ))}
      </div>

      {uploadPlatform && (
        <CsvUploadModal
          platform={uploadPlatform}
          onClose={() => setUploadPlatform(null)}
          onDone={(msg) => {
            setToast(msg);
            setUploadPlatform(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ConnCard({
  name,
  accounts,
  meta,
  state,
  actions,
}: {
  name: string;
  accounts: string;
  meta: string;
  state: ConnectionState;
  actions?: React.ReactNode;
}) {
  const isError = state === "error";
  const isMuted = state === "coming-soon";
  return (
    <Card
      style={{
        opacity: isMuted ? 0.55 : 1,
        borderColor: isError ? "var(--loss)" : "var(--border)",
        background: isError ? "var(--loss-soft)" : "var(--bg-elevated)",
      }}
      className="card-hover"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[14px] font-semibold">{name}</div>
          <div className="text-[11px] text-[color:var(--text-muted)] uppercase tracking-wider mt-0.5">
            {accounts}
          </div>
        </div>
        <StatusBadge state={state} />
      </div>
      <div
        className="text-[11.5px] mono mt-2"
        style={{ color: "var(--text-muted)" }}
      >
        {meta}
      </div>
      {actions && <div className="mt-4 flex gap-2 justify-end">{actions}</div>}
    </Card>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mt-6 mb-3">
      <div className="text-[14px] font-semibold">{title}</div>
      <div className="text-[11.5px] text-[color:var(--text-muted)] mt-0.5">
        {subtitle}
      </div>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-36" />
      ))}
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function CsvUploadModal({
  platform,
  onClose,
  onDone,
}: {
  platform: "fidelity" | "robinhood";
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setUploading(true);
    setErr(null);
    const form = new FormData();
    form.set("platform", platform);
    form.set("file", file);
    try {
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setErr(body.error ?? "Upload failed");
        setUploading(false);
        return;
      }
      onDone(
        `${platform}: imported ${body.imported.holdings} holdings, ${body.imported.accounts} accounts`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-[520px] p-6"
        style={{ background: "var(--bg-elevated)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-[16px] font-semibold capitalize">
              Upload {platform} CSV
            </h3>
            <p className="text-[12px] text-[color:var(--text-muted)] mt-1">
              {platform === "fidelity"
                ? "Export positions from Fidelity → Accounts & Trade → Portfolio → Download."
                : "Export from Robinhood → Account → Statements & History → Activity."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div
          className="rounded-md p-6 text-center mt-4"
          style={{
            border: "1.5px dashed var(--border-strong)",
            background: "var(--bg-inset)",
          }}
        >
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full"
          />
          {file && (
            <div className="mt-3 text-[12px] mono text-[color:var(--text-muted)]">
              Selected: {file.name} ({Math.ceil(file.size / 1024)} KB)
            </div>
          )}
        </div>

        {err && (
          <div
            className="mt-3 text-[12px] px-3 py-2 rounded"
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

        <div className="mt-5 flex items-center justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={!file || uploading}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
