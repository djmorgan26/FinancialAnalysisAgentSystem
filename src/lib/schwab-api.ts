/**
 * Schwab Individual Trader API — Read-only integration.
 *
 * Handles OAuth 2.0 authorization code flow and provides typed
 * helpers for fetching accounts, positions, and transactions.
 *
 * Setup:
 *   1. Register at https://developer.schwab.com
 *   2. Create an app → select "Accounts and Trading Production"
 *   3. Set callback URL to http://localhost:3000/api/schwab/callback
 *   4. Copy App Key + Secret into .env.local
 */

import { promises as fs } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SCHWAB_AUTH_URL = "https://api.schwabapi.com/v1/oauth/authorize";
const SCHWAB_TOKEN_URL = "https://api.schwabapi.com/v1/oauth/token";
const SCHWAB_API_BASE = "https://api.schwabapi.com/trader/v1";
const CALLBACK_URL =
  process.env.SCHWAB_CALLBACK_URL || "http://localhost:3000/api/schwab/callback";
const APP_KEY = process.env.SCHWAB_APP_KEY || "";
const APP_SECRET = process.env.SCHWAB_APP_SECRET || "";

// Token persistence path
const TOKEN_PATH = path.join(
  process.cwd(),
  "config",
  ".schwab-tokens.json"
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SchwabTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  refresh_expires_at: number; // epoch ms
}

export interface SchwabAccount {
  accountNumber: string;
  hashValue: string;
}

export interface SchwabAccountDetail {
  securitiesAccount: {
    accountNumber: string;
    type: string; // "INDIVIDUAL", "IRA", etc.
    roundTrips: number;
    isDayTrader: boolean;
    isClosingOnlyRestricted: boolean;
    positions?: SchwabPosition[];
    currentBalances: {
      availableFunds: number;
      buyingPower: number;
      cashBalance: number;
      liquidationValue: number;
      totalCash: number;
      moneyMarketFund: number;
      longMarketValue: number;
      shortMarketValue: number;
    };
  };
}

export interface SchwabPosition {
  shortQuantity: number;
  averagePrice: number;
  currentDayProfitLoss: number;
  currentDayProfitLossPercentage: number;
  longQuantity: number;
  settledLongQuantity: number;
  settledShortQuantity: number;
  instrument: {
    assetType: string;
    cusip: string;
    symbol: string;
    description: string;
    type?: string;
  };
  marketValue: number;
  maintenanceRequirement: number;
  currentDayCost: number;
  previousSessionLongQuantity: number;
}

export interface SchwabTransaction {
  activityId: number;
  time: string;
  type: string;
  status: string;
  subAccount: string;
  tradeDate: string;
  netAmount: number;
  description: string;
  transferItems?: {
    instrument: { symbol: string; description: string };
    amount: number;
    cost: number;
    price: number;
  }[];
}

// ---------------------------------------------------------------------------
// Token Management
// ---------------------------------------------------------------------------

async function loadTokens(): Promise<SchwabTokens | null> {
  try {
    const raw = await fs.readFile(TOKEN_PATH, "utf-8");
    return JSON.parse(raw) as SchwabTokens;
  } catch {
    return null;
  }
}

async function saveTokens(tokens: SchwabTokens): Promise<void> {
  await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

function basicAuthHeader(): string {
  return (
    "Basic " + Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString("base64")
  );
}

// ---------------------------------------------------------------------------
// OAuth Flow
// ---------------------------------------------------------------------------

/**
 * Step 1: Generate the URL the user must visit to authorize the app.
 */
export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: APP_KEY,
    redirect_uri: CALLBACK_URL,
    scope: "api",
  });
  return `${SCHWAB_AUTH_URL}?${params.toString()}`;
}

/**
 * Step 2: Exchange the authorization code for tokens.
 * Called from the /api/schwab/callback route.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<SchwabTokens> {
  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CALLBACK_URL,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const now = Date.now();
  const tokens: SchwabTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: now + (data.expires_in || 1800) * 1000, // ~30 min
    refresh_expires_at: now + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  await saveTokens(tokens);
  return tokens;
}

/**
 * Refresh the access token using the refresh token.
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<SchwabTokens> {
  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const now = Date.now();
  const tokens: SchwabTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: now + (data.expires_in || 1800) * 1000,
    refresh_expires_at: now + 7 * 24 * 60 * 60 * 1000,
  };

  await saveTokens(tokens);
  return tokens;
}

/**
 * Get a valid access token, refreshing if needed.
 * Returns null if no tokens exist or refresh token has expired.
 */
export async function getValidToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  // Refresh token expired → user must re-auth
  if (Date.now() > tokens.refresh_expires_at) {
    return null;
  }

  // Access token still valid (with 60s buffer)
  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  // Refresh the access token
  try {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    return refreshed.access_token;
  } catch (err) {
    console.error("Failed to refresh Schwab token:", err);
    return null;
  }
}

/**
 * Check connection status.
 */
export async function getConnectionStatus(): Promise<{
  connected: boolean;
  expiresAt: string | null;
  needsReauth: boolean;
}> {
  const tokens = await loadTokens();
  if (!tokens) {
    return { connected: false, expiresAt: null, needsReauth: true };
  }
  const needsReauth = Date.now() > tokens.refresh_expires_at;
  return {
    connected: !needsReauth,
    expiresAt: new Date(tokens.refresh_expires_at).toISOString(),
    needsReauth,
  };
}

// ---------------------------------------------------------------------------
// API Helpers (read-only)
// ---------------------------------------------------------------------------

async function schwabFetch<T>(endpoint: string): Promise<T> {
  const token = await getValidToken();
  if (!token) {
    throw new Error("SCHWAB_NOT_CONNECTED");
  }

  const res = await fetch(`${SCHWAB_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Schwab API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API Methods
// ---------------------------------------------------------------------------

/**
 * List all linked account numbers and hash values.
 */
export async function listAccounts(): Promise<SchwabAccount[]> {
  return schwabFetch<SchwabAccount[]>("/accounts/accountNumbers");
}

/**
 * Get detailed account info including positions for all accounts.
 */
export async function getAccountDetails(): Promise<SchwabAccountDetail[]> {
  return schwabFetch<SchwabAccountDetail[]>("/accounts?fields=positions");
}

/**
 * Get positions for a specific account.
 */
export async function getAccountPositions(
  encryptedAccountId: string
): Promise<SchwabAccountDetail> {
  return schwabFetch<SchwabAccountDetail>(
    `/accounts/${encryptedAccountId}?fields=positions`
  );
}

/**
 * Get transactions for a specific account.
 */
export async function getTransactions(
  encryptedAccountId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string
): Promise<SchwabTransaction[]> {
  const params = new URLSearchParams({
    startDate: `${startDate}T00:00:00.000Z`,
    endDate: `${endDate}T23:59:59.000Z`,
    types: "TRADE,DIVIDEND_OR_INTEREST,ACH,WIRE",
  });
  return schwabFetch<SchwabTransaction[]>(
    `/accounts/${encryptedAccountId}/transactions?${params.toString()}`
  );
}

/**
 * Fetch everything in one call: all accounts with positions.
 * This is the main entry point for the dashboard refresh.
 */
export async function fetchAllSchwabData(): Promise<{
  accounts: SchwabAccountDetail[];
  fetchedAt: string;
}> {
  const accounts = await getAccountDetails();
  return {
    accounts,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Check if the Schwab API is configured (env vars present).
 */
export function isConfigured(): boolean {
  const isPlaceholder = (v: string) => !v || v.startsWith("your_") || v === "changeme";
  return !isPlaceholder(APP_KEY) && !isPlaceholder(APP_SECRET);
}
