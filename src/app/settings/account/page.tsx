import { requireUser } from "@/lib/supabase/server";
import { AccountForm } from "./AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const { user } = await requireUser();
  return <AccountForm email={user.email ?? ""} />;
}
