# Schwab API Setup Guide

Register your own Schwab Individual Developer app so this dashboard can pull your account data (positions, balances, transactions) directly from Schwab.

**Who this is for:** Individual Schwab customers who want to fork this repo and run the dashboard for their own personal finances. You are your own user — there is no "multi-tenant" version of this app.

**What you get:** Read-only access to your own Schwab brokerage/IRA/401k data via OAuth 2.0.

**What you won't get:** Real-time trading, order placement, or unattended long-term sync (see "The 7-day refresh token reality" below).

---

## Part 1: Prerequisites

1. A Charles Schwab account with at least one brokerage/retirement account.
2. This repo deployed somewhere with HTTPS. We recommend Vercel — see `README.md` for deploy instructions. Note your production URL; you'll need it below.

## Part 2: Register as an Individual Developer

One-time, account-level approval (separate from app creation).

1. Go to <https://developer.schwab.com> and sign in with your Schwab account credentials.
2. Navigate to **API Products**.
3. Find the **"Trader API - Individual"** card and click **Request Access**.
4. Wait for approval (usually same-day to 1–2 business days).

Do NOT request access to any "Schwab API Products" (those are institutional — Advisor Services, etc. — and require a separate vetting process you don't need).

## Part 3: Create the App

Once Individual Developer access is approved, in the developer portal:

1. Go to **Dashboard → Apps → Create App**.
2. Fill out the form with these values (adjust for your own URL):

| Field | Value |
|---|---|
| **App Name** | `Personal Finance Dashboard` |
| **App Description** | `Personal-use read-only dashboard aggregating my own Schwab account positions, balances, and transactions for budgeting and net-worth tracking. No trading, no third-party users.` |
| **API Products** | ✅ `Accounts and Trading Production` (required)<br>✅ `Market Data Production` (recommended for live quotes) |
| **Callback URL** | `https://YOUR-PROJECT.vercel.app/api/schwab/callback,https://127.0.0.1:8182` |
| **Order Limit** | `0` |

### Callback URL — exact-match rules

Schwab enforces byte-exact match between the URL registered here and the `redirect_uri` your app sends during OAuth. Get these wrong and OAuth fails with a cryptic error.

- **HTTPS required** everywhere except `127.0.0.1` (the one allowed plain-IP exception).
- **255 character total limit** across all URLs combined (comma-separated).
- **Trailing slashes matter** — whatever you register must match exactly.
- **No query strings** in the registered URL.
- Multiple URLs allowed, comma-separated. Register both your production URL AND the local dev URL (`https://127.0.0.1:8182`) in a single app so you don't need two Schwab apps.

### Order Limit = 0

This dashboard is read-only — it never places trades. Setting Order Limit to `0` hard-blocks any accidental POST to the orders endpoint at the Schwab layer. Belt-and-suspenders safety.

### Description wording matters

Schwab rejects app descriptions that sound institutional or commercial. Avoid: *"algorithmic"*, *"trading system"*, *"platform"*, *"advisor"*, *"hedge"*, *"clients"*, *"users"*. Personal-use, mundane, read-only wording sails through.

## Part 4: Wait for approval

New apps enter status **"Approved — Pending"** — the `client_id` and `secret` shown at this stage are NOT yet usable. Wait for the status to flip to **"Ready for Use"** (typically 1–3 business days).

You'll get an email notification. Do not attempt OAuth before the status flips, or you'll get opaque auth errors.

## Part 5: Configure your deployment

Once your app shows **"Ready for Use"**, copy the **App Key** (client_id) and **Secret** (client_secret) from the app's detail page in the portal.

### Local development (`.env.local`)

Create `.env.local` in the repo root (gitignored — never commit this):

```bash
SCHWAB_APP_KEY=your_app_key_here
SCHWAB_APP_SECRET=your_app_secret_here
SCHWAB_CALLBACK_URL=https://127.0.0.1:8182
```

See the section below on running local HTTPS on `127.0.0.1:8182` — Schwab won't redirect to `http://localhost`, so plain `npm run dev` on port 3000 won't work for the OAuth leg.

### Vercel production

From the repo root, after `vercel link`:

```bash
# Add the three secrets to Vercel production
printf "YOUR_APP_KEY"       | vercel env add SCHWAB_APP_KEY production
printf "YOUR_APP_SECRET"    | vercel env add SCHWAB_APP_SECRET production
printf "https://YOUR-PROJECT.vercel.app/api/schwab/callback" | vercel env add SCHWAB_CALLBACK_URL production

# Redeploy so the new env vars are picked up
vercel --prod
```

Verify:

```bash
vercel env ls
```

**Never commit credentials** — `.env.local` is gitignored, but `.env.example` is not. Keep `.env.example` to placeholders only.

## Part 6: First-time OAuth

1. Open your deployed dashboard and navigate to the Schwab connection section.
2. Click the "Connect Schwab" button — you'll be redirected to Schwab's login.
3. Log in with your Schwab credentials.
4. On the consent screen, **select which accounts** to grant the app access to. Pick all the accounts you want in the dashboard.
5. Schwab redirects you back to your callback URL with a `code` parameter; the app exchanges it for access + refresh tokens and stores them on the server.

You're connected.

## The 7-day refresh token reality

⚠️ **This is the most important operational constraint of the Schwab API.**

- **Access tokens live 30 minutes** — auto-refreshed transparently by the app.
- **Refresh tokens live 7 days — HARD LIMIT, not extendable.**
- After 7 days, you must interactively log in again to get a new refresh token. A fully "set and forget" unattended sync is **not possible** on the Schwab API.
- Plan for a weekly manual re-login. The dashboard UI should prompt you when the refresh token is near expiry.

Schwab has acknowledged this limitation and not changed it despite years of developer pushback. It is the single biggest design constraint when building on their API.

## Local HTTPS on `127.0.0.1:8182`

Because Schwab rejects plain `http://localhost` callbacks, local OAuth testing requires HTTPS on port 8182. Options:

- Use [`mkcert`](https://github.com/FiloSottile/mkcert) to generate a trusted local cert, then run Next.js with `--experimental-https --experimental-https-port 8182`.
- Or skip local OAuth entirely and only test OAuth on the deployed Vercel URL. The rest of the app works fine locally with imported CSV data — only the live API sync requires the OAuth dance.

The simpler path for most users: register the Schwab app, test OAuth once against the deployed Vercel URL, then develop locally against the CSV importers (which don't need any API access).

## Troubleshooting

- **"Approved — Pending" for >3 business days:** check the creator email inbox for a Schwab request for more info. Worst case, delete and recreate the app with more-clearly-personal wording.
- **OAuth redirect fails with `redirect_uri_mismatch`:** your registered URL doesn't byte-exact match what the app is sending. Check trailing slashes and scheme (`https://` vs `http://`). Verify `SCHWAB_CALLBACK_URL` matches one of the URLs on the Schwab app page character-for-character.
- **`401` from Schwab after a week of working fine:** your refresh token expired. Re-run the OAuth flow.
- **Rate limit `429-001` or `429-005`:** you're above ~120 req/min. Back off 60 seconds.

## Rate limits (reference)

- Read endpoints (accounts, positions, transactions, market data): ~120 req/min.
- Order endpoints: 0–120/min, governed by the Order Limit field (set to 0 for this app).

## Official docs

- [Create an App](https://developer.schwab.com/user-guides/apis-and-apps/create-an-app)
- [Callback URL Requirements](https://developer.schwab.com/user-guides/apis-and-apps/app-callback-url-requirements)
- [Become an Individual Developer](https://developer.schwab.com/user-guides/individual-developer/become-individual-developer)
- [Authenticate with OAuth](https://developer.schwab.com/user-guides/get-started/authenticate-with-oauth)
- [OAuth Restart vs. Refresh Token (7-day limit)](https://developer.schwab.com/user-guides/apis-and-apps/oauth-restart-vs-refresh-token)
