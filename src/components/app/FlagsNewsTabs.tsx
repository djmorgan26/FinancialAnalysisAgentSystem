"use client";

import { useState } from "react";
import type { Insight } from "@/lib/types";
import { FlagsList } from "./FlagsList";
import { NewsFeed } from "./NewsFeed";

type Tab = "flags" | "news";

export function FlagsNewsTabs({ flags }: { flags: Insight[] }) {
  const [tab, setTab] = useState<Tab>("flags");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <TabButton active={tab === "flags"} onClick={() => setTab("flags")}>
            Flags
            <span
              className="chip ml-2"
              style={{ fontSize: 10, padding: "0 6px" }}
            >
              {flags.length}
            </span>
          </TabButton>
          <TabButton active={tab === "news"} onClick={() => setTab("news")}>
            News
          </TabButton>
        </div>
      </div>

      {tab === "flags" ? (
        <FlagsList flags={flags} />
      ) : (
        <NewsFeed variant="compact" />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-[13px] font-semibold rounded-md inline-flex items-baseline"
      style={{
        background: active ? "var(--bg-inset)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        border: `1px solid ${active ? "var(--border)" : "transparent"}`,
      }}
    >
      {children}
    </button>
  );
}
