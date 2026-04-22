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
    <header className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[13px] text-[color:var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="px-8 py-8 max-w-[1400px] mx-auto">{children}</div>;
}
