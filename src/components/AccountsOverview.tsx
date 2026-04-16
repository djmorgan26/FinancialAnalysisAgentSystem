"use client";

import type { Account } from "@/lib/types";
import { formatCurrency, prettifyLabel } from "@/lib/format";

interface AccountsOverviewProps {
  accounts: Account[];
}

const platformColors: Record<string, string> = {
  fidelity: "#4ade80",
  schwab: "#60a5fa",
  robinhood: "#a78bfa",
  coinbase: "#f59e0b",
  chase: "#3b82f6",
  citi: "#06b6d4",
  manual: "#737373",
};

const accountTypeIcons: Record<string, string> = {
  checking: "C",
  savings: "S",
  brokerage: "B",
  roth_401k: "R4",
  roth_ira: "RI",
  traditional_401k: "T4",
  traditional_ira: "TI",
  credit_card: "CC",
  crypto: "CR",
  other: "O",
};

export default function AccountsOverview({ accounts }: AccountsOverviewProps) {
  if (accounts.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4 text-foreground">Accounts</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
    </section>
  );
}

function AccountCard({ account }: { account: Account }) {
  const color = platformColors[account.platform] ?? "#737373";
  const isLiability = account.accountType === "credit_card";
  const balanceColor = isLiability ? "text-negative" : "text-foreground";

  return (
    <div className="group rounded-lg border border-card-border bg-card p-4 transition-colors hover:bg-card-hover">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {accountTypeIcons[account.accountType] ?? "?"}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground leading-tight">
              {account.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {prettifyLabel(account.platform)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <p className={`text-xl font-semibold tabular-nums ${balanceColor}`}>
          {formatCurrency(account.balance)}
        </p>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-full border border-card-border">
          {prettifyLabel(account.accountType)}
        </span>
      </div>
    </div>
  );
}
