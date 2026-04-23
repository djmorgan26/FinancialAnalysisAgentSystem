/**
 * Coinbase Advanced Trade / CDP API — Read-only portfolio access.
 * Uses Ed25519 JWT auth (the new CDP key format), not the legacy HMAC SHA256.
 *
 * Setup: Create a CDP API key at https://portal.cdp.coinbase.com/
 *   Permissions: "Portfolio: Primary View" is enough for read-only access.
 *   COINBASE_API_KEY=<uuid key id>
 *   COINBASE_API_SECRET=<base64-encoded 64-byte Ed25519 key>
 */

import crypto from "crypto";

const API_KEY = process.env.COINBASE_API_KEY || "";
const API_SECRET = process.env.COINBASE_API_SECRET || "";
const API_HOST = "api.coinbase.com";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrokerageAccount {
  uuid: string;
  name: string;
  currency: string;
  available_balance: { value: string; currency: string };
  hold?: { value: string; currency: string };
  type: string;
  active: boolean;
  ready: boolean;
}

interface ProductTicker {
  price: string;
  product_id: string;
}

export interface CoinbaseHolding {
  symbol: string;
  name: string;
  quantity: number;
  valueUSD: number;
  currency: string;
  currentPrice: number;
}

// ---------------------------------------------------------------------------
// JWT / Ed25519 signing
// ---------------------------------------------------------------------------

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Build a Node.js Ed25519 private key object from Coinbase's base64-encoded
 * 64-byte secret (first 32 bytes = seed, last 32 bytes = public key — we only
 * need the seed to sign).
 */
function importEd25519Key(base64Secret: string): crypto.KeyObject {
  const bytes = Buffer.from(base64Secret, "base64");
  if (bytes.length !== 64) {
    throw new Error(
      `Invalid Coinbase secret length: got ${bytes.length} bytes, expected 64 (base64-decoded).`
    );
  }
  const seed = bytes.slice(0, 32);
  // PKCS#8 DER prefix for an Ed25519 private key, followed by the 32-byte seed.
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const der = Buffer.concat([pkcs8Prefix, seed]);
  return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

function signJWT(keyId: string, base64Secret: string, method: string, path: string): string {
  const privateKey = importEd25519Key(base64Secret);
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "EdDSA",
    typ: "JWT",
    kid: keyId,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const payload = {
    sub: keyId,
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    uri: `${method.toUpperCase()} ${API_HOST}${path}`,
  };

  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;
  const signature = crypto.sign(null, Buffer.from(signingInput), privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function coinbaseFetch<T>(path: string): Promise<T> {
  if (!API_KEY || !API_SECRET) {
    throw new Error("COINBASE_NOT_CONFIGURED");
  }

  // JWT uri claim excludes query string; use the bare path for signing
  const pathForJWT = path.split("?")[0];
  const jwt = signJWT(API_KEY, API_SECRET, "GET", pathForJWT);

  const res = await fetch(`https://${API_HOST}${path}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coinbase API error (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAccounts(): Promise<BrokerageAccount[]> {
  const out: BrokerageAccount[] = [];
  let cursor = "";
  do {
    const qs = cursor ? `?limit=250&cursor=${encodeURIComponent(cursor)}` : "?limit=250";
    const page = await coinbaseFetch<{ accounts: BrokerageAccount[]; cursor: string; has_next: boolean }>(
      `/api/v3/brokerage/accounts${qs}`
    );
    out.push(...page.accounts);
    cursor = page.has_next ? page.cursor : "";
  } while (cursor);
  return out;
}

async function getSpotPrice(currency: string): Promise<number> {
  if (currency === "USD" || currency === "USDC") return 1;
  try {
    const ticker = await coinbaseFetch<ProductTicker>(
      `/api/v3/brokerage/market/products/${currency}-USD`
    );
    const p = parseFloat(ticker.price);
    return isNaN(p) ? 0 : p;
  } catch (err) {
    console.error(`[coinbase-api.getSpotPrice] failed for ${currency}:`, err);
    return 0;
  }
}

/**
 * Fetch non-zero crypto holdings with USD valuations.
 */
export async function getHoldings(): Promise<CoinbaseHolding[]> {
  const accounts = await getAccounts();
  const nonZero = accounts.filter((a) => {
    const bal = parseFloat(a.available_balance?.value ?? "0");
    const hold = parseFloat(a.hold?.value ?? "0");
    return bal + hold > 0;
  });

  const holdings: CoinbaseHolding[] = [];
  for (const a of nonZero) {
    const qty =
      parseFloat(a.available_balance?.value ?? "0") +
      parseFloat(a.hold?.value ?? "0");
    const price = await getSpotPrice(a.currency);
    holdings.push({
      symbol: a.currency,
      name: a.name || a.currency,
      quantity: qty,
      valueUSD: qty * price,
      currency: a.currency,
      currentPrice: price,
    });
  }
  return holdings;
}

export function isConfigured(): boolean {
  const isPlaceholder = (v: string) =>
    !v || v.startsWith("your_") || v === "changeme";
  return !isPlaceholder(API_KEY) && !isPlaceholder(API_SECRET);
}
