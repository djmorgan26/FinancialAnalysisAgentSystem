"use client";

import { useState, useEffect, useCallback } from "react";

interface AllConnections {
  schwab: {
    configured: boolean;
    connected: boolean;
    authUrl?: string | null;
    expiresAt?: string | null;
    needsReauth?: boolean;
  };
  finnhub: {
    configured: boolean;
    connected: boolean;
  };
  coinbase: {
    configured: boolean;
    connected: boolean;
  };
}

interface SyncResult {
  success?: boolean;
  accountCount?: number;
  positionCount?: number;
  pricesUpdated?: number;
  fetchedAt?: string;
  error?: string;
}

export default function DataConnections() {
  const [connections, setConnections] = useState<AllConnections | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Record<string, SyncResult>>({});
  const [showSetup, setShowSetup] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/connections");
      const data = await res.json();
      setConnections(data);
    } catch {
      // Silent fail — component just won't render statuses
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("schwab") === "connected") {
      fetchStatus();
      window.history.replaceState({}, "", "/");
    }
  }, [fetchStatus]);

  const handleSchwabSync = async () => {
    setSyncing("schwab");
    try {
      const res = await fetch("/api/schwab", { method: "POST" });
      const data = await res.json();
      setLastSync((prev) => ({ ...prev, schwab: data }));
      if (data.success) fetchStatus();
    } catch {
      setLastSync((prev) => ({ ...prev, schwab: { error: "Network error" } }));
    } finally {
      setSyncing(null);
    }
  };

  const handlePriceRefresh = async () => {
    setSyncing("finnhub");
    try {
      const res = await fetch("/api/prices", { method: "POST" });
      const data = await res.json();
      setLastSync((prev) => ({ ...prev, finnhub: data }));
    } catch {
      setLastSync((prev) => ({
        ...prev,
        finnhub: { error: "Network error" },
      }));
    } finally {
      setSyncing(null);
    }
  };

  const handleFullRefresh = async () => {
    setSyncing("all");
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();
      setLastSync((prev) => ({ ...prev, all: { success: data.overall?.success, fetchedAt: data.overall?.timestamp } }));
      fetchStatus();
    } catch {
      setLastSync((prev) => ({ ...prev, all: { error: "Network error" } }));
    } finally {
      setSyncing(null);
    }
  };

  if (!connections) return null;

  const schwab = connections.schwab;
  const fhub = connections.finnhub;
  const cb = connections.coinbase;

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Data Connections
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live API connections to your financial accounts
          </p>
        </div>
        <button
          onClick={handleFullRefresh}
          disabled={syncing !== null}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
        >
          {syncing === "all" ? "Refreshing..." : "Refresh All"}
        </button>
      </div>

      <div className="space-y-3">
        {/* Schwab */}
        <ConnectionCard
          name="Charles Schwab"
          description="Individual, Roth IRA, Checking, Savings"
          accounts="4 accounts"
          status={
            schwab.connected
              ? "connected"
              : schwab.configured
                ? "disconnected"
                : "not_configured"
          }
          expiresAt={schwab.expiresAt}
          onConnect={
            schwab.authUrl
              ? () => window.open(schwab.authUrl!, "_self")
              : undefined
          }
          onSync={schwab.connected ? handleSchwabSync : undefined}
          syncing={syncing === "schwab"}
          lastSync={lastSync.schwab}
          onSetup={() =>
            setShowSetup(showSetup === "schwab" ? null : "schwab")
          }
        />
        {showSetup === "schwab" && (
          <SetupGuide
            steps={[
              "Go to developer.schwab.com and create a Developer Portal account",
              'Create an app → select "Accounts and Trading Production"',
              "Set callback URL to: http://localhost:3000/api/schwab/callback",
              "Wait for approval (up to 2 business days)",
              "Copy App Key and Secret to .env.local in project root",
            ]}
            envVars="SCHWAB_APP_KEY=your_app_key\nSCHWAB_APP_SECRET=your_app_secret"
          />
        )}

        {/* Finnhub */}
        <ConnectionCard
          name="Finnhub"
          description="Real-time prices, news, sentiment"
          accounts="Market data"
          status={
            fhub.connected
              ? "connected"
              : fhub.configured
                ? "disconnected"
                : "not_configured"
          }
          onSync={fhub.connected ? handlePriceRefresh : undefined}
          syncing={syncing === "finnhub"}
          lastSync={lastSync.finnhub}
          onSetup={() =>
            setShowSetup(showSetup === "finnhub" ? null : "finnhub")
          }
        />
        {showSetup === "finnhub" && (
          <SetupGuide
            steps={[
              "Go to finnhub.io and sign up (free)",
              "Copy your API key from the dashboard",
              "Add it to .env.local in your project root",
              "Restart the dev server",
            ]}
            envVars="FINNHUB_API_KEY=your_api_key"
          />
        )}

        {/* Fidelity - manual */}
        <ConnectionCard
          name="Fidelity"
          description="Roth 401(k), BrokerageLink"
          accounts="2 accounts"
          status="manual"
          note="No public API available. Uses CSV import."
        />

        {/* Robinhood - manual */}
        <ConnectionCard
          name="Robinhood"
          description="Individual Brokerage"
          accounts="1 account"
          status="manual"
          note="No official stocks API. Uses copy-paste import."
        />

        {/* Coinbase */}
        <ConnectionCard
          name="Coinbase"
          description="Crypto"
          accounts="1 account"
          status={
            cb.connected
              ? "connected"
              : cb.configured
                ? "disconnected"
                : "not_configured"
          }
          note={
            cb.configured
              ? undefined
              : "Free API available."
          }
          onSetup={() =>
            setShowSetup(showSetup === "coinbase" ? null : "coinbase")
          }
        />
        {showSetup === "coinbase" && (
          <SetupGuide
            steps={[
              "Go to portal.cdp.coinbase.com and sign in",
              "Create an API key with read-only permissions",
              "Add key and secret to .env.local",
              "Restart the dev server",
            ]}
            envVars="COINBASE_API_KEY=your_api_key\nCOINBASE_API_SECRET=your_api_secret"
          />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectionCard({
  name,
  description,
  accounts,
  status,
  expiresAt,
  note,
  onConnect,
  onSync,
  syncing,
  lastSync,
  onSetup,
}: {
  name: string;
  description: string;
  accounts: string;
  status: "connected" | "disconnected" | "not_configured" | "manual";
  expiresAt?: string | null;
  note?: string;
  onConnect?: () => void;
  onSync?: () => void;
  syncing?: boolean;
  lastSync?: SyncResult | null;
  onSetup?: () => void;
}) {
  const statusColors = {
    connected: "bg-green-500",
    disconnected: "bg-yellow-500",
    not_configured: "bg-neutral-600",
    manual: "bg-blue-500",
  };

  const statusLabels = {
    connected: "Connected",
    disconnected: "Disconnected",
    not_configured: "Not Set Up",
    manual: "Manual Import",
  };

  return (
    <div className="rounded-lg border border-card-border bg-[#161616] p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`w-2 h-2 rounded-full mt-1.5 ${statusColors[status]}`}
          />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
            <p className="text-[10px] text-muted mt-0.5">{accounts}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              status === "connected"
                ? "bg-green-500/10 text-green-400"
                : status === "manual"
                  ? "bg-blue-500/10 text-blue-400"
                  : status === "disconnected"
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-neutral-500/10 text-muted-foreground"
            }`}
          >
            {statusLabels[status]}
          </span>

          {onSync && (
            <button
              onClick={onSync}
              disabled={syncing}
              className="text-xs px-2.5 py-1 rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          )}

          {onConnect && (
            <button
              onClick={onConnect}
              className="text-xs px-2.5 py-1 rounded-md bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
            >
              Connect
            </button>
          )}

          {status === "not_configured" && onSetup && (
            <button
              onClick={onSetup}
              className="text-xs px-2.5 py-1 rounded-md bg-neutral-600/20 text-muted-foreground hover:text-foreground transition-colors"
            >
              Set Up
            </button>
          )}
        </div>
      </div>

      {expiresAt && status === "connected" && (
        <p className="text-[10px] text-muted mt-2 ml-5">
          Token valid until{" "}
          {new Date(expiresAt).toLocaleDateString()} — re-auth every 7 days
        </p>
      )}

      {note && (
        <p className="text-[10px] text-muted mt-2 ml-5">{note}</p>
      )}

      {lastSync && (
        <div className="mt-2 ml-5">
          {lastSync.success ? (
            <p className="text-[10px] text-green-400">
              {lastSync.accountCount
                ? `Synced ${lastSync.accountCount} accounts, ${lastSync.positionCount} positions`
                : lastSync.pricesUpdated
                  ? `Updated ${lastSync.pricesUpdated} prices`
                  : "Synced successfully"}
              {lastSync.fetchedAt &&
                ` at ${new Date(lastSync.fetchedAt).toLocaleTimeString()}`}
            </p>
          ) : lastSync.error ? (
            <p className="text-[10px] text-red-400">
              Error: {lastSync.error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SetupGuide({
  steps,
  envVars,
}: {
  steps: string[];
  envVars: string;
}) {
  return (
    <div className="rounded-lg bg-[#1a1a1a] border border-card-border p-4 text-sm">
      <div className="space-y-2 text-muted-foreground">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-blue-400 font-mono font-bold shrink-0">
              {i + 1}.
            </span>
            <span>{step}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 p-2 rounded bg-[#111] font-mono text-xs text-green-400 whitespace-pre">
        {envVars}
      </div>
      <p className="text-xs text-muted mt-2">
        Add to <code className="text-foreground">.env.local</code> in your
        project root, then restart the dev server.
      </p>
    </div>
  );
}
