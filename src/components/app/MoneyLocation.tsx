import { Card } from "./Pill";
import { formatCurrency, prettifyLabel } from "@/lib/format";
import type { AllocationBreakdown } from "@/lib/types";

interface Props {
  accountBreakdown: AllocationBreakdown[];
  totalAssets: number;
}

export function MoneyLocation({ accountBreakdown, totalAssets }: Props) {
  const rows = [...accountBreakdown]
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const top = rows[0];

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Where your money lives</h3>
          <p
            className="text-[11.5px] mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Account-level balance distribution.
          </p>
        </div>
        <div className="text-right">
          <div
            className="text-[10.5px] uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Total assets
          </div>
          <div className="mono text-[16px] font-semibold">
            {formatCurrency(Math.round(totalAssets))}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div
          className="mt-4 text-[12px]"
          style={{ color: "var(--text-muted)" }}
        >
          No account balances yet.
        </div>
      ) : (
        <>
          {/* Stacked bar */}
          <div
            className="mt-4 h-3 rounded-full overflow-hidden flex"
            style={{ background: "var(--bg-inset)" }}
          >
            {rows.map((r, i) => (
              <div
                key={r.label}
                style={{
                  width: `${r.percent}%`,
                  background: `hsl(${(i * 47) % 360} 55% 55%)`,
                }}
                title={`${prettifyLabel(r.label)} — ${formatCurrency(r.value)}`}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-2.5">
            {rows.map((r, i) => (
              <li key={r.label} className="flex items-baseline justify-between">
                <span className="flex items-center gap-2 text-[12.5px]">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: `hsl(${(i * 47) % 360} 55% 55%)` }}
                  />
                  <span className="font-medium">
                    {prettifyLabel(r.label)}
                  </span>
                </span>
                <span className="mono text-[12.5px]">
                  <span className="font-semibold">
                    {formatCurrency(Math.round(r.value))}
                  </span>
                  <span
                    className="ml-2 font-normal"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {r.percent.toFixed(1)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {top && (
            <p
              className="mt-4 text-[12px] leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {narrate(rows, top)}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function narrate(
  rows: AllocationBreakdown[],
  top: AllocationBreakdown
) {
  const topLabel = prettifyLabel(top.label);
  const topPct = top.percent.toFixed(0);
  if (top.percent > 60) {
    return `${topLabel} is carrying ${topPct}% of your balance sheet — concentration risk if that account, platform, or custodian ever has an issue. Consider diversifying where the dollars live, not just what they're invested in.`;
  }
  if (rows.length >= 4) {
    return `Spread across ${rows.length} accounts — ${topLabel} leads at ${topPct}%. A healthy distribution; just make sure each one has a clear purpose (emergency, taxable, tax-advantaged).`;
  }
  return `${topLabel} holds ${topPct}% — the anchor of your current setup. Over time you'll want your tax-advantaged buckets (Roth IRA, 401k) to grow as a share of the whole.`;
}
