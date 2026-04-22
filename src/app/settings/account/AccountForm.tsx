"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { Card } from "@/components/app/Pill";
import { PageHeader } from "@/components/app/Page";

export function AccountForm({ email }: { email: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function changePassword() {
    if (newPassword.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setErr(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setMsg("Password updated.");
      setNewPassword("");
    }
  }

  async function signOut() {
    await fetch("/api/auth?action=signout", { method: "POST" });
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Account"
        subtitle="Sign-in and data controls."
      />

      {msg && (
        <div
          className="mb-4 px-3 py-2 rounded text-[12px]"
          style={{
            background: "var(--gain-soft)",
            color: "var(--gain)",
            border: "1px solid color-mix(in oklab, var(--gain) 40%, transparent)",
          }}
        >
          {msg}
        </div>
      )}
      {err && (
        <div
          className="mb-4 px-3 py-2 rounded text-[12px]"
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

      <Card className="mb-4">
        <h3 className="text-[14px] font-semibold mb-4">Sign-in</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium mb-1.5 text-[color:var(--text-muted)]">
              Email
            </label>
            <input className="input input-mono" value={email} disabled />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5 text-[color:var(--text-muted)]">
              New password
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                className="input input-mono"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="at least 8 characters"
              />
              <button
                onClick={changePassword}
                className="btn btn-sm"
                disabled={busy || !newPassword}
              >
                {busy ? "…" : "Change"}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 text-[11px] text-[color:var(--text-muted)]">
          Two-factor auth is coming. Google sign-in is planned for a future
          release.
        </div>
      </Card>

      <Card>
        <h3 className="text-[14px] font-semibold mb-2">Session</h3>
        <p className="text-[12px] text-[color:var(--text-muted)] mb-4">
          Sign out on this device.
        </p>
        <button className="btn btn-sm" onClick={signOut}>
          Sign out
        </button>
      </Card>
    </>
  );
}
