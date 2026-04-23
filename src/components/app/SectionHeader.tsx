import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: ReactNode;
}) {
  return (
    <div className="mb-3">
      <div
        className="text-[10.5px] uppercase tracking-[0.14em]"
        style={{ color: "var(--accent-strong)" }}
      >
        {eyebrow}
      </div>
      <h2 className="mt-1 text-[18px] font-semibold tracking-tight">{title}</h2>
      {lede && (
        <p
          className="mt-1.5 text-[12.5px] leading-relaxed max-w-[760px]"
          style={{ color: "var(--text-muted)" }}
        >
          {lede}
        </p>
      )}
    </div>
  );
}
