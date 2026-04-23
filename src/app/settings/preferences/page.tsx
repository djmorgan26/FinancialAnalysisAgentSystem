import { requireUser } from "@/lib/supabase/server";
import { loadInvestmentPreferences, loadFinancialData } from "@/lib/data-store";
import { PreferencesForm } from "./PreferencesForm";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const { user } = await requireUser();
  const [prefs, data] = await Promise.all([
    loadInvestmentPreferences(user.id),
    loadFinancialData(user.id),
  ]);
  const accounts = data.accounts
    .filter((a) => a.accountType !== "credit_card")
    .map((a) => ({
      id: a.id,
      name: a.name,
      platform: a.platform,
      accountType: a.accountType,
      balance: a.balance,
    }))
    .sort((a, b) => b.balance - a.balance);
  return <PreferencesForm initial={prefs} accounts={accounts} />;
}
