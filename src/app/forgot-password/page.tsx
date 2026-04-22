"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { AuthShell, AuthField, AuthAltLink } from "@/components/ui/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings/account`,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to reset it."
      footer={<AuthAltLink prompt="Remembered it?" href="/sign-in" label="Sign in" />}
    >
      {sent ? (
        <div
          className="text-[12.5px] px-3 py-3 rounded"
          style={{
            background: "var(--info-soft)",
            color: "var(--info)",
            border: "1px solid color-mix(in oklab, var(--info) 40%, transparent)",
          }}
        >
          Check your inbox. The reset link is valid for one hour.
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <AuthField label="Email">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-mono"
              placeholder="you@example.com"
            />
          </AuthField>

          {error && (
            <div
              className="mb-3 text-[12px] px-3 py-2 rounded"
              style={{
                background: "var(--loss-soft)",
                color: "var(--loss)",
                border:
                  "1px solid color-mix(in oklab, var(--loss) 40%, transparent)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg w-full"
          >
            {loading ? "Sending…" : "Send reset link →"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
