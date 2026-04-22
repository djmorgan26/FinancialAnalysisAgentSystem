# Financial Analysis Agent System

Personal finance dashboard with live integrations, investment analysis, and AI-driven recommendations. Solo today, multi-user later. See `docs/PRD_v2.md`.

## Stack
Next.js 16 · TypeScript · Tailwind · Supabase (Postgres + RLS) · Recharts · deployed on Vercel.

## Commands
```bash
npm run dev              # Dashboard at localhost:3000
npm run import           # CSV → normalized JSON → Supabase (non-Schwab)
npm run analyze          # Run analysis pipeline
npm run update           # import → analyze
npm run invest:brief     # Build the /invest data bundle (human: -- --human)
npm run test:coinbase    # Smoke test CDP Ed25519 client
```

## Slash commands
`.claude/commands/invest.md` — `/invest [optional context]` produces an actionable brief by running `npm run invest:brief` and analyzing the JSON.

## Verification scripts (multi-user app)

Use these when testing auth-gated features. **Never reset the owner's password** — always use the dedicated test user whose credentials live in `.env.local`:

```bash
# One-time (or when you need to reset the test user's state):
npx tsx scripts/ensure-test-user.ts

# Smoke tests — sign in as TEST_USER, hit production, assert 200:
npx tsx scripts/verify-dashboard.ts    # GET / — confirms dashboard renders
npx tsx scripts/verify-assistant.ts    # POST /api/assistant — confirms Gemini wiring
```

`TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are in `.env.local`. `ensure-test-user.ts` creates the auth user (email-confirmed), resyncs the password if it drifted, and seeds a `user_profiles` row with `onboarding_complete = true` so the scripts don't get redirected to /onboarding. Base URL defaults to the production alias; pass a different URL as `argv[2]` for local testing.

**Do NOT** write ad-hoc scripts that reset the owner's password (`davidjmorgan26@gmail.com`) to get a session. Extend `verify-*.ts` or `ensure-test-user.ts` instead.

## Source of truth per data type

Everything is **per-user** now (keyed by `auth.users.id`). See `src/lib/supabase/{server,browser,admin}.ts` for the three client flavors.

| Data | Lives in | Why |
|---|---|---|
| Accounts, holdings, transactions, snapshots, sync logs | Supabase tables with `user_id` FK + RLS | Per-user cloud persistence |
| Schwab OAuth tokens | Supabase `schwab_tokens` (one row per user) | Tokens are per-user; `state` param carries user_id through OAuth |
| Analysis cache | Supabase `analysis_cache` (one row per user) | Cheap to regenerate, dashboard auto-recomputes if stale |
| Investment preferences | Supabase `investment_preferences` (one row per user) | Edited from Settings + AI assistant tools |
| User profile (name, age, income, risk, horizon, sector bias, fixed expenses, payroll) | Supabase `user_profiles` (one row per user) | Edited from Settings; onboarding gate reads `onboarding_complete` |
| Raw CSVs | `data/raw/{platform}/` | User drops them here |
| Secrets | `.env.local` (gitignored) + Vercel envs | Standard |

## Where things live (route quickly, don't re-discover)

- **Canonical types** — `src/lib/types.ts`
- **Supabase client** — `src/lib/supabase.ts` (`getSupabase()` — service role)
- **Data store** — `src/lib/data-store.ts` (row↔domain mappers)
- **Integrations**:
  - Schwab API — `src/lib/schwab-api.ts`, route `src/app/api/schwab/route.ts`
  - Coinbase CDP (Ed25519 JWT) — `src/lib/coinbase-api.ts`, route `src/app/api/coinbase/route.ts`
  - Finnhub — `src/lib/finnhub-api.ts`
  - CSV importers — `src/lib/importers/{fidelity,robinhood,schwab,coinbase,chase,citi}.ts`
- **Analysis engine** — `src/lib/analysis/`
- **/invest gatherer** — `scripts/invest-brief.ts`
- **/invest prompt** — `.claude/commands/invest.md`
- **Connections UI** — `src/components/DataConnections.tsx`, API `src/app/api/connections/route.ts`
- **Supabase project** — ref `zphekqczgynysgnssrbb` (see `memory/project_supabase.md`)

## Non-obvious rules

- **Balance semantics**: Schwab accounts use `currentBalances.liquidationValue` (authoritative, includes uninvested cash). `accounts.balance ≠ sum(holdings.current_value)` intentionally — the delta is SWVXX.
- **Fractional crypto / cash**: never apply a Finnhub stock quote to `asset_class in ('cash','crypto')` — symbols like `CASH`, `BTC`, `ETH` match real tickers and produce garbage valuations. `scripts/invest-brief.ts` filters by asset class before quote lookup.
- **Schwab account classification**: `securitiesAccount.type` is CASH/MARGIN (margin permission), NOT brokerage-vs-IRA. Use `SCHWAB_ACCOUNT_NICKNAMES` env for display names.
- **CSV import pushes non-Schwab to Supabase**. Schwab stays API-driven — do NOT push Schwab CSV data to Supabase; it would clobber live API data. `scripts/import.ts` filters this.
- **Ghost accounts**: user-profile.json accounts list seeds `robinhood-individual`, `fidelity-401k`, `fidelity-brokerage` IDs that have no holdings. `import.ts` filters these out of the Supabase push.

## Environment variables

Required:
```
# Auth / DB
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY   # browser/middleware (@supabase/ssr)
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY                   # server admin client

# Integrations
SCHWAB_APP_KEY, SCHWAB_APP_SECRET, SCHWAB_CALLBACK_URL, SCHWAB_ACCOUNT_NICKNAMES
FINNHUB_API_KEY
COINBASE_API_KEY, COINBASE_API_SECRET                     # CDP Ed25519 format
GEMINI_API_KEY                                            # gemini-2.5-flash (free tier)

# Verification scripts (owner's local only — never committed, never deployed)
TEST_USER_EMAIL, TEST_USER_PASSWORD                       # dedicated test user
TARGET_USER_ID                                            # optional, for CLI scripts that push data
```

See `.env.example` for template. Keys live in Vercel production/development envs as well.

## Docs
- `docs/PRD_v2.md` — product PRD (non-technical)
- `docs/ARCHITECTURE_v2.md` — technical architecture (target)
- `docs/ROADMAP.md` — phased plan
- `docs/SCHWAB_SETUP.md` — Schwab developer app setup (for forking users)
- `docs/ARCHITECTURE.md` — legacy, pre-Supabase; superseded by ARCHITECTURE_v2

## When to fetch what (guidance for the AI)

- User asks "what's in my portfolio?" → query `holdings` joined on `accounts`
- User asks about recommendations → run `/invest` workflow (script + command prompt)
- User asks about today's movers → `scripts/invest-brief.ts` populates `positions[].todayChangePercent`
- User asks about contribution room → `investment_preferences.roth_ira_*`
- User asks why something broke → `sync_logs` recent rows for that source
- User asks about a ticker you don't know → WebSearch, then cite
