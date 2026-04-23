import { requireUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOnboardingComplete, loadFinancialData } from "@/lib/data-store";
import { AppShell } from "./Shell";
import type { QuickSearchItem } from "./QuickSearch";

export async function ShellWrapper({
  children,
  skipOnboardingCheck = false,
}: {
  children: React.ReactNode;
  skipOnboardingCheck?: boolean;
}) {
  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    redirect("/sign-in");
  }

  if (!skipOnboardingCheck) {
    const done = await getOnboardingComplete(user.id);
    if (!done) redirect("/onboarding");
  }

  // Live account sum — never cached, never stale.
  const data = await loadFinancialData(user.id);
  const netWorth = data.accounts.reduce((s, a) => s + a.balance, 0);

  const email = user.email ?? null;
  const initial = (email?.[0] ?? "•").toUpperCase();

  const netWorthPill = data.accounts.length
    ? {
        value: `$${Math.round(netWorth).toLocaleString()}`,
        delta: undefined,
        tone: "neutral" as const,
      }
    : null;

  const searchItems = buildSearchIndex(data);

  return (
    <AppShell
      user={{ email, initial }}
      syncSummary={null}
      netWorthPill={netWorthPill}
      searchItems={searchItems}
    >
      {children}
    </AppShell>
  );
}

function buildSearchIndex(
  data: Awaited<ReturnType<typeof loadFinancialData>>
): QuickSearchItem[] {
  const items: QuickSearchItem[] = [];

  for (const a of data.accounts) {
    items.push({
      type: "account",
      label: a.name,
      subtitle: `${a.platform} · ${a.accountType.replace(/_/g, " ")} · $${Math.round(a.balance).toLocaleString()}`,
      href: "/analysis",
      keywords: `${a.platform} ${a.accountType}`,
    });
  }

  // Aggregate holdings by symbol so the palette doesn't show VTI twice.
  const bySymbol = new Map<
    string,
    { symbol: string; name: string; value: number; accountCount: number }
  >();
  for (const h of data.holdings) {
    const key = h.symbol || h.name;
    if (!key) continue;
    const prev = bySymbol.get(key);
    if (prev) {
      prev.value += h.currentValue;
      prev.accountCount += 1;
    } else {
      bySymbol.set(key, {
        symbol: h.symbol,
        name: h.name,
        value: h.currentValue,
        accountCount: 1,
      });
    }
  }
  const holdings = [...bySymbol.values()].sort((a, b) => b.value - a.value);
  for (const h of holdings) {
    items.push({
      type: "holding",
      label: h.symbol || h.name,
      subtitle: `${h.name || h.symbol} · $${Math.round(h.value).toLocaleString()}${h.accountCount > 1 ? ` · ${h.accountCount} accounts` : ""}`,
      href: `/analysis?q=${encodeURIComponent(h.symbol)}`,
      keywords: `${h.name} ${h.symbol}`,
    });
  }

  return items;
}
