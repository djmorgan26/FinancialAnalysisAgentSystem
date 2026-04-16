"use client";

import type { Insight } from "@/lib/types";

interface InsightsPanelProps {
  insights: Insight[];
}

const typeConfig: Record<
  Insight["type"],
  { icon: React.ReactNode; bgColor: string; textColor: string; borderColor: string }
> = {
  warning: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378c.635 1.19-.168 2.575-1.543 2.575H1.918c-1.375 0-2.178-1.385-1.543-2.575L6.457 1.047zM8 5a.75.75 0 01.75.75v2.5a.75.75 0 01-1.5 0v-2.5A.75.75 0 018 5zm0 6a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
    ),
    bgColor: "bg-warning-muted",
    textColor: "text-warning",
    borderColor: "border-warning/20",
  },
  opportunity: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm1.062 4.312a1.75 1.75 0 00-2.593.72l-.08.174a.75.75 0 001.373.608l.08-.174a.25.25 0 01.37-.103c.155.108.174.282.137.398-.04.12-.152.236-.397.3a.75.75 0 00-.537.824l.167 1.073a.75.75 0 001.482-.23l-.053-.34c.569-.2.985-.591 1.146-1.122.17-.56.03-1.17-.454-1.63a1.75 1.75 0 00-.64-.398zM8 10.5a1 1 0 100 2 1 1 0 000-2z" />
      </svg>
    ),
    bgColor: "bg-positive-muted",
    textColor: "text-positive",
    borderColor: "border-positive/20",
  },
  info: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-3a1 1 0 100-2 1 1 0 000 2zm-.25 2a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 007.75 7z" />
      </svg>
    ),
    bgColor: "bg-info-muted",
    textColor: "text-info",
    borderColor: "border-info/20",
  },
};

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <section className="rounded-lg border border-card-border bg-card p-5">
      <h2 className="text-lg font-semibold mb-4 text-foreground">Insights</h2>

      <div className="space-y-3">
        {insights.map((insight, i) => {
          const config = typeConfig[insight.type];
          return (
            <div
              key={i}
              className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}
            >
              <div className="flex items-start gap-3">
                <span className={`${config.textColor} mt-0.5 flex-shrink-0`}>
                  {config.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {insight.title}
                    </h3>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded border border-card-border">
                      {insight.category}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {insight.description}
                  </p>
                  {insight.actionable && insight.action && (
                    <p className="text-sm text-muted-foreground mt-2 pl-3 border-l-2 border-card-border">
                      {insight.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
