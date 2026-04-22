import { requireUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOnboardingComplete, loadFinancialData } from "@/lib/data-store";
import { AppShell } from "./Shell";

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

  return (
    <AppShell
      user={{ email, initial }}
      syncSummary={null}
      netWorthPill={netWorthPill}
    >
      {children}
    </AppShell>
  );
}
