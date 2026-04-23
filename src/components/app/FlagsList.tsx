"use client";

import { useState } from "react";
import type { Insight } from "@/lib/types";

const INITIAL_VISIBLE = 4;

export function FlagsList({ flags }: { flags: Insight[] }) {
  const [expanded, setExpanded] = useState(false);

  if (flags.length === 0) {
    return (
      <div className="text-[12px] text-[color:var(--text-muted)]">
        Nothing flagged right now.
      </div>
    );
  }

  const visible = expanded ? flags : flags.slice(0, INITIAL_VISIBLE);
  const hiddenCount = flags.length - INITIAL_VISIBLE;

  return (
    <>
      <ul className="space-y-3">
        {visible.map((f, i) => (
          <li
            key={i}
            className="pb-3 last:pb-0 border-b last:border-0"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-start gap-2">
              <span
                className={`chip chip-${
                  f.type === "warning"
                    ? "warn"
                    : f.type === "opportunity"
                      ? "info"
                      : "muted"
                }`}
                style={{ fontSize: 10 }}
              >
                {f.category}
              </span>
              <div className="flex-1">
                <div className="text-[12.5px] font-medium">{f.title}</div>
                <div className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
                  {f.description}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-[12px] text-[color:var(--text-muted)] hover:text-[color:var(--text)] underline underline-offset-4"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </>
  );
}
