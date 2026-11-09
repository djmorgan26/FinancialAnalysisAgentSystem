# Read-only access for Claude

Goal: Claude can read the owner's balances, holdings, transactions and net-worth
history to help with decisions, can never change anything, and the data stays
current without anyone clicking Sync.

## Pieces

| Piece | Where | What it does |
|---|---|---|
| `claude_ro` schema | `supabase/migrations/20261109_claude_readonly_views.sql` | Views over the owner's rows only. No OAuth tokens, no memos, account numbers as last4 at most. |
| `claude_reader` role | same migration | `SELECT` on the `claude_ro` views and nothing else. `NOLOGIN` until a password is set deliberately. |
| Daily sync | `src/app/api/cron/sync/route.ts`, `vercel.json` | 11:00 UTC every day: Schwab (if signed in), Coinbase, analysis + one snapshot. Daily DB activity also keeps the free Supabase project from auto-pausing. |
| Owner lock | `src/lib/owner.ts` | Coinbase (an app-wide key) only syncs into owner accounts; sign-up is closed unless the email is allow-listed. |

## Views

- `claude_ro.accounts` — platform, type, name, last4, balance, `hours_since_update`
- `claude_ro.holdings` — positions with account name, value, gain/loss, asset class, sector
- `claude_ro.transactions` — last ~13 months, no memo
- `claude_ro.allocation` — totals by platform and asset class (rollup rows marked `all`)
- `claude_ro.net_worth_history` — daily snapshots
- `claude_ro.data_freshness` — last success / last problem per source, Schwab sign-in expiry

## Environment (Vercel, production)

| Var | Purpose |
|---|---|
| `CRON_SECRET` | Vercel sends it as a bearer token to `/api/cron/sync`; anything else gets 401. |
| `OWNER_USER_IDS` | Owner `auth.users` id(s). Who the cron syncs, and who Coinbase may sync into. |
| `ALLOWED_SIGNUP_EMAILS` | Optional. Unset = sign-up closed. |
| `NEXT_PUBLIC_DEMO_MODE` | Must be unset for the real app to serve data. |

## Switch-on checklist

1. Supabase project running (it auto-pauses on the free plan after a quiet week).
2. Apply the migration, then `insert into claude_ro.owner (user_id) values ('<owner id>');`
3. Set the env vars above and redeploy.
4. Owner signs in and reconnects Schwab once (Schwab sign-ins last 7 days; the
   cron logs `needs_reauth` when it runs out and `data_freshness` shows it).

## Known limits

- **Schwab:** Schwab's refresh token expires after 7 days by Schwab's rule, so
  Schwab data goes stale a week after the last reconnect. Fixing that for good
  means an aggregator (Plaid Investments or SnapTrade) instead of direct OAuth.
- **Robinhood:** CSV import only today; no automatic refresh.
- **Coinbase:** use a view-only CDP key (no trade or transfer permissions).
