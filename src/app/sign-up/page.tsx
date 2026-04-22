"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { AuthShell, AuthField, AuthAltLink } from "@/components/ui/AuthShell";

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/onboarding";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      // Email confirmation disabled → we're signed in immediately.
      router.replace(next);
      router.refresh();
    } else {
      setInfo(
        "Check your email to confirm your account. Once confirmed you'll be redirected back here."
      );
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Email + password for now. Google sign-in coming later."
      footer={
        <AuthAltLink
          prompt="Already have an account?"
          href={`/sign-in${next !== "/onboarding" ? `?next=${encodeURIComponent(next)}` : ""}`}
          label="Sign in"
        />
      }
    >
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
        <AuthField
          label="Password"
          hint="Minimum 8 characters. Use something you don't use elsewhere."
        >
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input input-mono"
            placeholder="••••••••••"
          />
        </AuthField>
        <AuthField label="Confirm password">
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input input-mono"
            placeholder="••••••••••"
          />
        </AuthField>

        {error && (
          <div
            className="mb-3 text-[12px] px-3 py-2 rounded"
            style={{
              background: "var(--loss-soft)",
              color: "var(--loss)",
              border: "1px solid color-mix(in oklab, var(--loss) 40%, transparent)",
            }}
          >
            {error}
          </div>
        )}
        {info && (
          <div
            className="mb-3 text-[12px] px-3 py-2 rounded"
            style={{
              background: "var(--info-soft)",
              color: "var(--info)",
              border: "1px solid color-mix(in oklab, var(--info) 40%, transparent)",
            }}
          >
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-lg w-full"
        >
          {loading ? "Creating account…" : "Create account →"}
        </button>
      </form>
    </AuthShell>
  );
}
