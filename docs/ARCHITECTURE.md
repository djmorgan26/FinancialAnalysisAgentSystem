# Architecture

**Last updated**: 2026-04-22

Pair with [PRD.md](./PRD.md) (product) and [ROADMAP.md](./ROADMAP.md) (phasing).

## System overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  External APIs  │     │   CSV imports   │     │   User input    │
│  Schwab, CB,    │     │  Fidelity, RH   │     │  preferences,   │
│  Finnhub, Plaid │     │  (drag-drop)    │     │  profile        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    ┌──────────────────────────────────────────────────────────┐
    │              Unified DataSource layer                     │
    │  Every platform implements the same interface regardless │
    │  of whether data comes from an API or a CSV.             │
    └────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │    Normalizer    │
                    │  (shared types)  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     Supabase     │    single source of truth
                    │  (Postgres + RLS)│
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   ┌─────────┐         ┌──────────┐         ┌──────────┐
   │ Next.js │         │ Claude   │         │  Gemini  │
   │ Dashboard│        │ Code     │         │ in-app   │
   │ (UI)    │         │ /invest  │         │ chat     │
   └─────────┘         └──────────┘         └──────────┘
```

## The `DataSource` interface (key abstraction)

Every integration — API or CSV — implements this. Adding a new platform = writing one class and registering it.

```ts
// src/lib/sources/types.ts
export interface DataSource {
  readonly id: SourceId;              // "schwab" | "coinbase" | "fidelity" | "robinhood" | ...
  readonly kind: "api" | "csv";
  readonly displayName: string;       // "Charles Schwab"
  readonly supportedData: SupportedData[]; // ["accounts","holdings","transactions"]

  // All sources: return status info for the /connections UI
  getStatus(): Promise<SourceStatus>;  // configured? connected? last_sync? needs_reauth?

  // API sources: do the fetch directly
  // CSV sources: fetch from the latest uploaded CSV
  fetchAccounts(): Promise<Account[]>;
  fetchHoldings(): Promise<Holding[]>;
  fetchTransactions?(): Promise<Transaction[]>;

  // All sources: persist to Supabase (idempotent, stale-removal handled)
  syncToSupabase(opts?: SyncOptions): Promise<SyncResult>;
}

export interface SourceStatus {
  configured: boolean;    // creds present
  connected: boolean;     // last connection attempt succeeded
  lastSyncAt?: string;    // ISO
  lastSyncError?: string;
  needsReauth?: boolean;  // OAuth token expired
  authUrl?: string;       // if reauth needed
  dataFreshness?: "fresh" | "stale" | "very_stale";  // computed from lastSyncAt
}

export interface SyncResult {
  success: boolean;
  accountsUpserted: number;
  holdingsReplaced: number;
  transactionsAdded?: number;
  error?: string;
  fetchedAt: string;
}
```

**Registry** lives at `src/lib/sources/registry.ts`:

```ts
export const SOURCES: Record<SourceId, () => DataSource> = {
  schwab: () => new SchwabSource(),
  coinbase: () => new CoinbaseSource(),
  fidelity: () => new FidelitySource(),
  robinhood: () => new RobinhoodSource(),
  // ... add new sources here
};
```

**Standard API routes** driven by the registry:

```
GET  /api/sources                  → list all sources with status
GET  /api/sources/:id              → status of one source
POST /api/sources/:id/sync         → trigger sync
POST /api/sources/:id/upload       → CSV sources only, multipart upload
GET  /api/sources/:id/auth-url     → API sources needing OAuth
GET  /api/sources/:id/callback     → OAuth callback handler
```

This replaces the current ad-hoc `/api/schwab`, `/api/coinbase`, `/api/refresh` routes. Those stay as backward-compat wrappers during the transition.

## Normalizer layer

All DataSource implementations return objects matching the canonical types in `src/lib/types.ts`:

- `Account` — one per brokerage/bank account
- `Holding` — one per position (symbol in account)
- `Transaction` — one per buy/sell/dividend/transfer (optional per source)

Normalizers handle platform-specific quirks:
- Schwab's `securitiesAccount.type` = CASH/MARGIN is margin permission, not account classification → use nicknames env
- Coinbase's `available_balance` is in native currency → multiply by spot price for USD
- Robinhood's CSV has `Shares`/`Price` not `Quantity`/`Current Price` → aliased in importer
- Fidelity's `Cash` symbol → asset_class = "cash" (explicit match)

**Quality rule**: a normalizer should never return a holding with `asset_class="us_equity"` and a symbol that isn't a real stock ticker. If unsure, mark it `other` and surface a warning.

## Database schema

Multi-user. Every row keys off `auth.users.id`; RLS enforces `user_id = auth.uid()` on all user-owned tables.

```sql
-- Core entities (all carry user_id)
accounts           (id, user_id, platform, account_type, name, balance, currency, last_updated)
holdings           (id, user_id, account_id, platform, symbol, name, quantity, cost_basis,
                    current_price, current_value, gain_loss, gain_loss_percent,
                    asset_class, sector, last_updated)
transactions       (id, user_id, account_id, platform, date, description, amount,
                    category, subcategory, original_category, memo)

-- User config (one row per user)
user_profiles      (user_id, name, age, income, risk_tolerance, horizon_years,
                    sector_bias, fixed_expenses, payroll, onboarding_complete)
investment_preferences (user_id, roth_ira_*, cash_floor_*, core_*,
                    single_position_cap_percent, sector_caps, excluded_tickers,
                    allow_sell_recommendations, allow_tax_loss_harvesting, notes)

-- Auth tokens (per user)
schwab_tokens      (user_id, access_token, refresh_token, expires_at, refresh_expires_at)

-- Analytics / history
analysis_cache     (user_id, result jsonb, generated_at, updated_at)
snapshots          (id, user_id, date, net_worth, total_assets, total_liabilities, savings_rate)
snapshot_balances  (snapshot_id, account_id, balance)

-- Observability
sync_logs          (id, user_id, source, status, message, metadata jsonb, created_at)
```

Service-role client (`src/lib/supabase/admin.ts`) bypasses RLS for CLI scripts and trusted server work. The browser/server SSR clients (`src/lib/supabase/{browser,server}.ts`) go through RLS as the signed-in user.

## AI layer

Two systems, one data store.

### Claude Code `/invest` (power-user, local)

- Lives in `.claude/commands/invest.md`
- Runs `scripts/invest-brief.ts` → reads Supabase + fetches Finnhub → writes `data/normalized/invest-brief.json`
- Claude reads the JSON and the command prompt → produces structured recommendations
- Available only to repo owners running Claude Code locally
- **Strength**: deep reasoning, WebSearch for live research, multi-step analysis, honest uncertainty

### In-app Gemini assistant (all users)

- Lives in `src/lib/ai/gemini.ts` + `src/components/Assistant.tsx`
- Uses `@google/generative-ai` SDK, model `gemini-2.0-flash` or `gemini-2.5-pro` depending on task
- System prompt grounds on: user profile, investment preferences, current portfolio, connection status, recent analysis
- Tools available to the assistant (function calling):
  - `getPortfolioSummary()` — current state
  - `getHoldings()` — detailed positions
  - `getRecentSyncs()` — observability
  - `triggerSync(sourceId)` — (Phase 2 decision: enable or not?)
  - `explainFinanceTerm(term)` — educational
- Streams responses to the UI
- Every response ends with the legal disclaimer block (templated, not LLM-generated)

### Shared grounding

Both AI layers read the same Supabase tables and honor the same `investment_preferences` row. The difference is surface area — Claude Code can do deep CLI/file work, Gemini is conversational and runtime-bound.

## Repo layout (target for v2.0)

```
/
├── .claude/
│   └── commands/
│       └── invest.md              # Claude Code slash command
├── data/                          # gitignored except .gitkeep
│   ├── raw/{platform}/            # dropped CSVs
│   └── normalized/                # intermediate JSON cache for import merges
├── docs/
│   ├── PRD.md                     # product requirements
│   ├── ARCHITECTURE.md            # this doc
│   ├── ROADMAP.md                 # phased plan
│   ├── DATA_SOURCES.md            # CSV export instructions per platform
│   └── SCHWAB_SETUP.md            # Schwab developer app setup
├── scripts/
│   ├── import.ts                  # CSV → normalized → Supabase (non-Schwab)
│   ├── invest-brief.ts            # Claude Code /invest data gatherer
│   ├── test-coinbase.ts           # CDP smoke test
│   ├── ensure-test-user.ts        # bootstrap the dedicated verify user
│   └── verify-{dashboard,assistant}.ts  # auth-gated HTTP smoke tests
├── src/
│   ├── app/
│   │   ├── (dashboard)/           # route group — main UI
│   │   │   ├── page.tsx           # /
│   │   │   ├── connections/       # /connections
│   │   │   ├── analysis/          # /analysis
│   │   │   ├── history/           # /history
│   │   │   ├── assistant/         # /assistant (Gemini chat)
│   │   │   └── settings/          # /settings (preferences)
│   │   ├── onboarding/            # first-run flow (Phase 2)
│   │   └── api/
│   │       ├── sources/
│   │       │   └── [id]/
│   │       │       ├── route.ts       # GET status
│   │       │       ├── sync/route.ts  # POST sync
│   │       │       └── upload/route.ts # POST CSV (csv sources only)
│   │       ├── sources/route.ts       # GET list of all
│   │       ├── analysis/route.ts
│   │       ├── snapshots/route.ts
│   │       ├── ai/
│   │       │   ├── chat/route.ts      # Gemini streaming
│   │       │   └── tools/route.ts     # function-call handlers
│   │       └── {schwab,coinbase,...}/ # BC aliases, thin wrappers
│   ├── components/
│   │   ├── dashboard/             # dashboard-specific
│   │   ├── connections/           # connection cards, status badges
│   │   ├── assistant/             # chat UI
│   │   ├── ui/                    # shared primitives (buttons, cards)
│   │   └── charts/                # recharts wrappers
│   └── lib/
│       ├── sources/               # DataSource implementations
│       │   ├── types.ts           # DataSource interface
│       │   ├── registry.ts        # all-sources map
│       │   ├── base.ts            # shared BaseSource
│       │   ├── schwab/
│       │   ├── coinbase/
│       │   ├── fidelity/
│       │   ├── robinhood/
│       │   └── finnhub/           # market-data, not portfolio
│       ├── normalizers/           # cross-source normalization helpers
│       ├── analysis/              # analysis engine (existing)
│       ├── ai/
│       │   ├── gemini.ts          # client + prompt builders
│       │   └── tools.ts           # function-calling definitions
│       ├── db/
│       │   ├── supabase.ts        # client factory
│       │   └── queries.ts         # typed accessors
│       ├── types.ts               # canonical domain types
│       └── utils/                 # pure helpers
├── .env.local                     # gitignored
├── .env.example                   # committed template
├── CLAUDE.md                      # minimal router (see below)
└── ...
```

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| File names | kebab-case | `coinbase-api.ts`, `data-store.ts` |
| React components | PascalCase | `DataConnections.tsx` |
| TypeScript types | PascalCase | `CoinbaseHolding`, `SyncResult` |
| Variables, functions | camelCase | `getHoldings`, `accountId` |
| Constants | SCREAMING_SNAKE_CASE | `API_HOST`, `FINNHUB_BASE` |
| Supabase tables | snake_case | `investment_preferences` |
| Supabase columns | snake_case | `account_id`, `gain_loss_percent` |
| Source IDs | lowercase, one word | `schwab`, `coinbase`, `fidelity` |
| Env vars | SCREAMING_SNAKE_CASE, prefixed by service | `SCHWAB_APP_KEY`, `GEMINI_API_KEY` |
| API routes | kebab-case, REST semantics | `/api/sources/schwab/sync` |
| Slash commands | kebab-case `.md` | `.claude/commands/invest.md` |

## Security posture

### Current — multi-user, invite-only
- Supabase Auth (email/password); service-role key server-side only, never exposed to browser
- Every user-owned table carries `user_id uuid references auth.users(id) not null`; RLS policy `(user_id = auth.uid())` on all of them
- OAuth tokens (`schwab_tokens`) scoped per-user; OAuth callback carries `user_id` through the `state` param
- `.env.local` gitignored; production secrets in Vercel encrypted envs
- Publishable/anon key for client code; service_role only in server runtime
- No rate limiting yet (small invite group)

### Phase 3 — public beta
- Audit logs on every credential access and sync trigger
- Session binding for OAuth callbacks (prevent CSRF)
- Secrets rotation automation
- Privacy policy, ToS, DPA template
- SOC2-lite: documented access control, change management, backup procedures
- Penetration test before marketing the app
- Dependency scanning in CI
- **Posture**: "real people trust us with real money data; we can show evidence we're competent"

## Data flow reference — sync operation (canonical)

```
User clicks "Sync" on Schwab card in /connections
  ↓
POST /api/sources/schwab/sync
  ↓
SOURCES.schwab().syncToSupabase()
  ↓
SchwabSource.fetchAccounts() + fetchHoldings()   [uses stored OAuth token]
  ↓
Normalize → canonical Account[] + Holding[]
  ↓
Supabase upsert accounts (on conflict by id)
  ↓
Supabase delete holdings where platform=schwab + account_id in (...)
  ↓
Supabase insert new holdings
  ↓
Supabase insert sync_logs row (success + metadata)
  ↓
Return SyncResult to UI → toast "Synced 2 accounts, 39 positions"
  ↓
UI revalidates dashboard data
```

CSV flow is identical except the fetch step reads the uploaded CSV rather than calling an API.

## Observability

- Every sync writes to `sync_logs` — source, status, message, metadata (position counts, errors, etc.)
- The Connections UI shows last-sync status per source
- Phase 2: drain `sync_logs` and Next.js function logs to an external monitor (Vercel Observability / Logtail / Axiom)
- Phase 3: structured JSON logs for all `/api/*`, alerting on error rate > 1% over 5 min

## Known technical debt

- [ ] Ad-hoc API routes (`/api/schwab`, `/api/coinbase`) predate the unified `DataSource` abstraction — migrate to `/api/sources/{id}/*`
- [ ] Robinhood importer derives balance from position CSV only; no transaction support (Robinhood CSV exports split positions and transactions; we handle positions).
- [ ] Sector inference has known gaps (QQQM, QTUM, CRWV, PLTR, many single tickers fall to "other"). Worth replacing with a data source (Finnhub company-profile endpoint) in Phase 2.
- [ ] Fidelity 401(k) proprietary fund symbols (e.g., NON40O3YU) have no Finnhub quote — brief falls back to stored CSV price, which is fine but stale-by-definition.
- [ ] `/invest` brief hard-codes which asset classes get Finnhub quotes — generalize when adding fixed-income or international ETFs at scale.
