import { Card } from "./Pill";
import { formatCurrency, prettifyLabel } from "@/lib/format";
import type { AllocationBreakdown } from "@/lib/types";

interface Props {
  assetAllocation: AllocationBreakdown[];
  sectorExposure: AllocationBreakdown[];
}

export function PortfolioComposition({
  assetAllocation,
  sectorExposure,
}: Props) {
  const assets = [...assetAllocation].sort((a, b) => b.percent - a.percent);
  const sectors = [...sectorExposure].sort((a, b) => b.percent - a.percent);
  const topSector = sectors[0];
  const topAsset = assets[0];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-[14px] font-semibold">Asset mix</h3>
            <p
              className="text-[11.5px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Stocks, bonds, crypto, cash.
            </p>
          </div>
        </div>
        <AllocBars rows={assets} palette="asset" />
        {topAsset && (
          <p
            className="mt-4 text-[12px] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {narrateAssets(assets)}
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-[14px] font-semibold">Sector exposure</h3>
            <p
              className="text-[11.5px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Where your equity thesis lives.
            </p>
          </div>
        </div>
        <AllocBars rows={sectors.slice(0, 8)} palette="sector" />
        {topSector && (
          <p
            className="mt-4 text-[12px] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {narrateSectors(sectors)}
          </p>
        )}
      </Card>
    </div>
  );
}

function AllocBars({
  rows,
  palette,
}: {
  rows: AllocationBreakdown[];
  palette: "asset" | "sector";
}) {
  if (rows.length === 0) {
    return (
      <div
        className="mt-4 text-[12px]"
        style={{ color: "var(--text-muted)" }}
      >
        No breakdown available yet.
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.percent), 1);
  return (
    <ul className="mt-4 space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between text-[12px] mb-1">
            <span className="capitalize">{prettifyLabel(r.label)}</span>
            <span className="mono">
              <span className="font-semibold">{r.percent.toFixed(1)}%</span>
              <span
                className="ml-2 font-normal"
                style={{ color: "var(--text-faint)" }}
              >
                {formatCurrency(Math.round(r.value))}
              </span>
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-inset)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(r.percent / max) * 100}%`,
                background:
                  palette === "asset"
                    ? `hsl(${210 - i * 18} 60% 60%)`
                    : `hsl(${(i * 53) % 360} 55% 58%)`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function narrateAssets(assets: AllocationBreakdown[]) {
  const byLabel = (k: string) =>
    assets.find((a) => a.label.toLowerCase().includes(k.toLowerCase()));
  const stocks = byLabel("stock") ?? byLabel("equity");
  const cash = byLabel("cash");
  const crypto = byLabel("crypto");

  const parts: string[] = [];
  if (stocks && stocks.percent > 75) {
    parts.push(
      `Equities dominate at ${stocks.percent.toFixed(0)}% — aggressive, and appropriate while your horizon is long.`
    );
  } else if (stocks && stocks.percent >= 50) {
    parts.push(
      `Stocks at ${stocks.percent.toFixed(0)}% — a balanced growth tilt.`
    );
  }
  if (cash && cash.percent > 15) {
    parts.push(
      `Cash is ${cash.percent.toFixed(0)}% — meaningful drag; redeploy anything beyond your emergency fund.`
    );
  }
  if (crypto && crypto.percent > 10) {
    parts.push(
      `Crypto at ${crypto.percent.toFixed(0)}% — sized above typical bands; revisit if conviction slips.`
    );
  }
  if (parts.length === 0) {
    return `Mix is reasonable for a long-horizon investor — revisit quarterly as balances shift.`;
  }
  return parts.join(" ");
}

function narrateSectors(sectors: AllocationBreakdown[]) {
  if (sectors.length === 0) return "";
  const top = sectors[0];
  const over = sectors.filter((s) => s.percent >= 25);
  if (over.length > 0) {
    return `${prettifyLabel(top.label)} at ${top.percent.toFixed(0)}% is your biggest single-sector bet — make sure the thesis still holds and consider trimming if it drifts further.`;
  }
  if (sectors.length >= 6) {
    return `Spread across ${sectors.length} sectors with ${prettifyLabel(top.label)} leading at ${top.percent.toFixed(0)}%. Diversified — tactical trims only if a sector runs hot.`;
  }
  return `${prettifyLabel(top.label)} leads at ${top.percent.toFixed(0)}%. Broad index funds can fill any gaps in under-represented sectors.`;
}
