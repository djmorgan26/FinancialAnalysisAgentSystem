import { requireUser } from "@/lib/supabase/server";
import { loadInvestmentPreferences } from "@/lib/data-store";
import { PreferencesForm } from "./PreferencesForm";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const { user } = await requireUser();
  const prefs = await loadInvestmentPreferences(user.id);
  return <PreferencesForm initial={prefs} />;
}
