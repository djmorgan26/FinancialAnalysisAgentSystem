import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-[20px] sm:text-[24px] font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] text-[color:var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      )}
    </header>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-[1400px] mx-auto">
      {children}
    </div>
  );
}
