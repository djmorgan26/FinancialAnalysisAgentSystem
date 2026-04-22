import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand / marketing half */}
      <aside
        className="hidden lg:flex flex-col justify-between p-12 border-r"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(140deg, var(--bg-inset) 0%, var(--bg) 60%, var(--bg-inset) 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center font-semibold"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent-strong)",
              border: "1px solid var(--border)",
            }}
          >
            ƒ
          </div>
          <span className="text-[15px] font-semibold tracking-tight">
            Ledger
          </span>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            See everything.
            <br />
            Decide faster.
          </h1>
          <p className="mt-5 text-[14px] leading-relaxed text-[color:var(--text-muted)]">
            A personal finance dashboard that aggregates every brokerage, bank,
            and crypto account you have — and tells you what to do next, with
            specific dollar amounts.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            <span className="chip">Live APIs</span>
            <span className="chip">CSV imports</span>
            <span className="chip chip-accent">AI assistant</span>
            <span className="chip">Self-hosted</span>
          </div>
        </div>

        <p className="text-[11px] italic text-[color:var(--text-faint)]">
          Informational only — not financial, tax, or legal advice.
        </p>
      </aside>

      {/* Form half */}
      <main className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden mb-6 flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center font-semibold text-sm"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent-strong)",
                border: "1px solid var(--border)",
              }}
            >
              ƒ
            </div>
            <span className="text-sm font-semibold">Ledger</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {subtitle && (
            <p className="mt-1.5 text-[13px] text-[color:var(--text-muted)]">
              {subtitle}
            </p>
          )}

          <div className="mt-7">{children}</div>

          {footer && (
            <div className="mt-6 text-center text-[12.5px] text-[color:var(--text-muted)]">
              {footer}
            </div>
          )}

          <p className="mt-10 text-center text-[11px] italic text-[color:var(--text-faint)]">
            Informational only — not financial, tax, or legal advice.
          </p>
        </div>
      </main>
    </div>
  );
}

export function AuthField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-medium mb-1.5 text-[color:var(--text-muted)]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] text-[color:var(--text-faint)]">{hint}</p>
      )}
    </div>
  );
}

export function AuthAltLink({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <span>
      {prompt}{" "}
      <Link
        href={href}
        className="underline underline-offset-4 text-[color:var(--text)] hover:text-[color:var(--accent-strong)]"
      >
        {label}
      </Link>
    </span>
  );
}
