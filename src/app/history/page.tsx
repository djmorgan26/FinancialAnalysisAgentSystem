import { redirect } from "next/navigation";
import { ShellWrapper } from "@/components/app/ShellWrapper";
import { PageContainer, PageHeader } from "@/components/app/Page";
import { Card } from "@/components/app/Pill";
import { requireUser } from "@/lib/supabase/server";
import { getOnboardingComplete, loadSnapshots } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { user } = await requireUser();
  if (!(await getOnboardingComplete(user.id))) redirect("/onboarding");

  const snapshots = await loadSnapshots(user.id);

  return (
    <ShellWrapper>
      <PageContainer>
        <PageHeader
          title="History · snapshots"
          subtitle="How the portfolio has changed over time."
        />

        {snapshots.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <div className="text-[16px] font-semibold mb-1">
                No snapshots yet
              </div>
              <p className="text-[12px] text-[color:var(--text-muted)]">
                Snapshots are taken automatically when you run an analysis. Come
                back after your first sync.
              </p>
            </div>
          </Card>
        ) : (
          <>
            {/* Trend strip */}
            <Card className="mb-6">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)]">
                    Current net worth
                  </div>
                  <div className="mono text-[28px] font-semibold mt-1">
                    $
                    {Math.round(
                      snapshots[snapshots.length - 1]?.netWorth ?? 0
                    ).toLocaleString()}
                  </div>
                </div>
                <div className="text-[12px] text-[color:var(--text-muted)]">
                  {snapshots.length} snapshots recorded
                </div>
              </div>
              <Sparkline values={snapshots.map((s) => s.netWorth)} />
            </Card>

            {/* Snapshots table */}
            <Card padded={false}>
              <div
                className="grid px-5 py-2 text-[10px] uppercase tracking-wider"
                style={{
                  gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                  color: "var(--text-muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>Date</div>
                <div className="text-right">Net worth</div>
                <div className="text-right">Assets</div>
                <div className="text-right">Liabilities</div>
              </div>
              {[...snapshots].reverse().map((s) => (
                <div
                  key={s.id}
                  className="grid px-5 py-2.5 text-[12.5px]"
                  style={{
                    gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                    borderBottom: "1px dotted var(--border)",
                  }}
                >
                  <div>{new Date(s.date).toLocaleString()}</div>
                  <div className="mono text-right font-medium">
                    ${Math.round(s.netWorth).toLocaleString()}
                  </div>
                  <div
                    className="mono text-right"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ${Math.round(s.totalAssets).toLocaleString()}
                  </div>
                  <div
                    className="mono text-right"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ${Math.round(s.totalLiabilities).toLocaleString()}
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}
      </PageContainer>
    </ShellWrapper>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <div className="h-24 flex items-center justify-center text-[12px] text-[color:var(--text-muted)]">
        Not enough data yet.
      </div>
    );
  }
  const w = 1000;
  const h = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);

  const path = values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 10) - 5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-24"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
