"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { AuthShell, AuthField, AuthAltLink } from "@/components/ui/AuthShell";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue"
      footer={
        <AuthAltLink
          prompt="No account?"
          href={`/sign-up${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          label="Create one"
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
        <AuthField label="Password">
          <PasswordInput
            required
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••••"
          />
        </AuthField>

        <div className="flex items-center justify-between mb-4 text-[11.5px] text-[color:var(--text-muted)]">
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            <span>Keep me signed in</span>
          </label>
          <a
            href="/forgot-password"
            className="underline underline-offset-4 hover:text-[color:var(--text)]"
          >
            Forgot?
          </a>
        </div>

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

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-lg w-full"
        >
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </form>
    </AuthShell>
  );
}
