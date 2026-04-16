/**
 * GET /api/schwab — Connection status + auth URL
 * POST /api/schwab — Trigger data sync from Schwab
 */
import { NextResponse } from "next/server";
import {
  isConfigured,
  getConnectionStatus,
  getAuthorizationUrl,
  fetchAllSchwabData,
  getValidToken,
} from "@/lib/schwab-api";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message:
        "Schwab API not configured. Add SCHWAB_APP_KEY and SCHWAB_APP_SECRET to .env.local",
      setupGuide: {
        step1: "Go to https://developer.schwab.com and create an account",
        step2: 'Create an app → select "Accounts and Trading Production"',
        step3: "Set callback URL to: http://localhost:3000/api/schwab/callback",
        step4: "Copy App Key and Secret to .env.local in project root",
        envTemplate: "SCHWAB_APP_KEY=your_app_key\nSCHWAB_APP_SECRET=your_app_secret",
      },
    });
  }

  const status = await getConnectionStatus();
  return NextResponse.json({
    configured: true,
    ...status,
    authUrl: status.needsReauth ? getAuthorizationUrl() : null,
  });
}

export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Schwab API not configured" },
      { status: 400 }
    );
  }

  const token = await getValidToken();
  if (!token) {
    return NextResponse.json(
      {
        error: "Not connected to Schwab",
        authUrl: getAuthorizationUrl(),
      },
      { status: 401 }
    );
  }

  try {
    const data = await fetchAllSchwabData();

    // Save raw response for debugging
    const debugPath = path.join(
      process.cwd(),
      "data",
      "raw",
      "schwab",
      "schwab-api-latest.json"
    );
    await fs.mkdir(path.dirname(debugPath), { recursive: true });
    await fs.writeFile(debugPath, JSON.stringify(data, null, 2));

    // Transform and merge into normalized data
    const positions = transformSchwabPositions(data);

    // Save as CSV to match existing import pipeline
    const csvPath = path.join(
      process.cwd(),
      "data",
      "raw",
      "schwab",
      "schwab-positions.csv"
    );
    await fs.writeFile(csvPath, positionsToCsv(positions));

    return NextResponse.json({
      success: true,
      accountCount: data.accounts.length,
      positionCount: positions.length,
      fetchedAt: data.fetchedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Transform Schwab API response → CSV format matching our existing pipeline
// ---------------------------------------------------------------------------

interface NormalizedPosition {
  account: string;
  symbol: string;
  description: string;
  quantity: number;
  price: number;
  marketValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
}

function transformSchwabPositions(data: {
  accounts: Array<{
    securitiesAccount: {
      type: string;
      accountNumber: string;
      positions?: Array<{
        longQuantity: number;
        averagePrice: number;
        marketValue: number;
        instrument: { symbol: string; description: string };
      }>;
      currentBalances: {
        moneyMarketFund: number;
        totalCash: number;
      };
    };
  }>;
}): NormalizedPosition[] {
  const positions: NormalizedPosition[] = [];

  for (const acct of data.accounts) {
    const sa = acct.securitiesAccount;
    const accountLabel =
      sa.type === "INDIVIDUAL"
        ? "Individual"
        : sa.type === "ROTH_IRA" || sa.type === "IRA"
          ? "Roth IRA"
          : sa.type;

    if (sa.positions) {
      for (const pos of sa.positions) {
        const qty = pos.longQuantity;
        const price = qty > 0 ? pos.marketValue / qty : 0;
        const costBasis = pos.averagePrice * qty;
        const gainLoss = pos.marketValue - costBasis;
        const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

        positions.push({
          account: accountLabel,
          symbol: pos.instrument.symbol,
          description: pos.instrument.description,
          quantity: qty,
          price: Math.round(price * 100) / 100,
          marketValue: Math.round(pos.marketValue * 100) / 100,
          costBasis: Math.round(costBasis * 100) / 100,
          gainLoss: Math.round(gainLoss * 100) / 100,
          gainLossPercent: Math.round(gainLossPct * 100) / 100,
        });
      }
    }

    // Add money market / cash position
    const mmf = sa.currentBalances?.moneyMarketFund || 0;
    const cash = sa.currentBalances?.totalCash || 0;
    const cashTotal = mmf || cash;
    if (cashTotal > 0) {
      positions.push({
        account: accountLabel,
        symbol: "SWVXX",
        description: "SCHWAB PRIME ADVANTAGE MONEY FUND",
        quantity: cashTotal,
        price: 1.0,
        marketValue: cashTotal,
        costBasis: cashTotal,
        gainLoss: 0,
        gainLossPercent: 0,
      });
    }
  }

  return positions;
}

function positionsToCsv(positions: NormalizedPosition[]): string {
  const header = "Symbol,Description,Quantity,Price,Market Value,Cost Basis,Gain/Loss $,Gain/Loss %";
  const rows = positions.map(
    (p) =>
      `${p.symbol},${p.description},${p.quantity},${p.price},${p.marketValue},${p.costBasis},${p.gainLoss},${p.gainLossPercent}`
  );
  return [header, ...rows].join("\n") + "\n";
}
