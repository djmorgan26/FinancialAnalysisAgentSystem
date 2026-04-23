import type { Insight } from "@/lib/types";
import { Card } from "./Pill";
import { FlagsList } from "./FlagsList";

interface Props {
  insights: Insight[];
}

export function PlanInsights({ insights }: Props) {
  const warnings = insights.filter((i) => i.type === "warning");
  const opportunities = insights.filter((i) => i.type === "opportunity");
  const info = insights.filter((i) => i.type === "info");

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-semibold">What to watch</h3>
          <p
            className="text-[11.5px] mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            {insights.length === 0
              ? "Nothing flagged — run the analysis to surface risks and opportunities."
              : `${warnings.length} warning${warnings.length === 1 ? "" : "s"} · ${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"}${info.length ? ` · ${info.length} note${info.length === 1 ? "" : "s"}` : ""}`}
          </p>
        </div>
        {insights.length > 0 && (
          <div className="flex gap-1.5">
            {warnings.length > 0 && (
              <span className="chip chip-warn" style={{ fontSize: 10 }}>
                {warnings.length} risk
              </span>
            )}
            {opportunities.length > 0 && (
              <span className="chip chip-info" style={{ fontSize: 10 }}>
                {opportunities.length} opp
              </span>
            )}
          </div>
        )}
      </div>
      <FlagsList flags={insights} />
    </Card>
  );
}
