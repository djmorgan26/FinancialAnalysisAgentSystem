/**
 * Coinbase API — Read-only portfolio access.
 * Free for personal use.
 *
 * Setup: https://docs.coinbase.com → create API key with read permissions.
 *   COINBASE_API_KEY=your_key
 *   COINBASE_API_SECRET=your_secret
 */

import crypto from "crypto";

const API_KEY = process.env.COINBASE_API_KEY || "";
const API_SECRET = process.env.COINBASE_API_SECRET || "";
const BASE_URL = "https://api.coinbase.com/v2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoinbaseAccount {
  id: string;
  name: string;
  currency: { code: string; name: string };
  balance: { amount: string; currency: string };
  native_balance: { amount: string; currency: string };
  type: string;
}

export interface CoinbaseHolding {
  symbol: string;
  name: string;
  quantity: number;
  valueUSD: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function signRequest(
  method: string,
  path: string,
  body: string = ""
): { timestamp: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + path + body;
  const signature = crypto
    .createHmac("sha256", API_SECRET)
    .update(message)
    .digest("hex");
  return { timestamp, signature };
}

async function coinbaseFetch<T>(endpoint: string): Promise<T> {
  if (!API_KEY || !API_SECRET) {
    throw new Error("COINBASE_NOT_CONFIGURED");
  }

  const path = `/v2${endpoint}`;
  const { timestamp, signature } = signRequest("GET", path);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "CB-ACCESS-KEY": API_KEY,
      "CB-ACCESS-SIGN": signature,
      "CB-ACCESS-TIMESTAMP": timestamp,
      "CB-VERSION": "2024-01-01",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coinbase API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.data as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all Coinbase wallets/accounts with balances.
 */
export async function getAccounts(): Promise<CoinbaseAccount[]> {
  return coinbaseFetch<CoinbaseAccount[]>("/accounts?limit=100");
}

/**
 * Fetch holdings (accounts with non-zero balances).
 */
export async function getHoldings(): Promise<CoinbaseHolding[]> {
  const accounts = await getAccounts();

  return accounts
    .filter((a) => parseFloat(a.balance.amount) > 0)
    .map((a) => ({
      symbol: a.currency.code,
      name: a.currency.name,
      quantity: parseFloat(a.balance.amount),
      valueUSD: parseFloat(a.native_balance.amount),
      currency: a.currency.code,
    }));
}

/**
 * Check if Coinbase API is configured.
 */
export function isConfigured(): boolean {
  const isPlaceholder = (v: string) => !v || v.startsWith("your_") || v === "changeme";
  return !isPlaceholder(API_KEY) && !isPlaceholder(API_SECRET);
}
