import { requireUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getOnboardingComplete,
  loadAnalysis,
} from "@/lib/data-store";
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

  const analysis = await loadAnalysis(user.id);
  const email = user.email ?? null;
  const initial = (email?.[0] ?? "•").toUpperCase();

  const netWorthPill = analysis
    ? {
        value: `$${Math.round(analysis.netWorth).toLocaleString()}`,
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
