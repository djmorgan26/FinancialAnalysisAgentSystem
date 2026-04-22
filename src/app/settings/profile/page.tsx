import { requireUser } from "@/lib/supabase/server";
import { loadUserProfile } from "@/lib/data-store";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const { user } = await requireUser();
  const profile = await loadUserProfile(user.id);
  return <ProfileForm initial={profile} />;
}
