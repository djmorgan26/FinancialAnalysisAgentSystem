# Roadmap

**Last updated**: 2026-04-22

Four phases. Phase 1 is "solo-ready for David," Phase 3 is "public beta." Each phase has **exit criteria** — the next phase doesn't start until the previous one is actually done. No calendar estimates here; phases ship when the criteria are met.

Phases 1 and 2 have landed; active work is now in Phase 3 territory.

---

## Phase 1 — Solo MVP (strangler-fig refactor + new UI) ✅ shipped

**Goal**: Daily `/invest` workflow runs in under 30 seconds with full-picture data. Dashboard clearly shows what's connected, what's CSV-based, what's coming. Preferences editable without SQL. Code is organized around the unified `DataSource` interface from top to bottom.

**Approach**: Strangler-fig, not rewrite. Build the new layer alongside the old, migrate one integration at a time, ship the new UI on new routes. `/invest` must keep working at every step.

### Migration sequence (ordered, not timed)

1. **Foundation — introduce the abstraction**
   - Create `src/lib/sources/` with `types.ts` (`DataSource` interface), `base.ts` (shared helpers), `registry.ts` (empty, to populate)
   - No behavior change yet; no route reads from it

2. **First migration — Schwab (proves the pattern)**
   - Move Schwab logic into `src/lib/sources/schwab/` as a `SchwabSource` class implementing `DataSource`
   - Existing `src/lib/schwab-api.ts` becomes a thin re-export so `/api/schwab` and the current dashboard keep working
   - Register `SchwabSource` in the registry
   - **Checkpoint**: `/invest` still runs; Schwab sync still works; nothing in the UI has changed

3. **Second migration — all other integrations**
   - Coinbase, Fidelity (CSV), Robinhood (CSV), Finnhub (market data only, not portfolio) each become `<Name>Source` classes
   - Each old module becomes a thin re-export
   - **Checkpoint**: every platform goes through the `DataSource` interface; behavior unchanged

4. **New standard routes — driven by the registry**
   - Build `/api/sources` (list all with status), `/api/sources/[id]` (single status), `/api/sources/[id]/sync` (POST), `/api/sources/[id]/upload` (POST, CSV sources only)
   - Old routes (`/api/schwab`, `/api/coinbase`, `/api/refresh`) become thin aliases calling the new ones
   - **Checkpoint**: both old and new routes work; new UI development can begin

5. **New UI — built on new routes only**
   - `/connections` page (source cards with honest status — Connected / CSV-stale / Not set up / Coming soon)
   - CSV upload via drag-drop on the connections page, not `npm run import`
   - `/settings` page — every field in `investment_preferences` editable without SQL
   - Revised dashboard on the new data routes
   - `/onboarding` flow (Phase 1 version: profile + first connection + first preferences)

6. **Secondary cleanup**
   - Sector inference backed by Finnhub's company-profile endpoint (kill the generic "other" bucket)
   - `/invest` brief reads freshness per source, cites it in the brief ("Fidelity data is X days stale")
   - Unified `SyncLog` viewer in the UI (powered by `sync_logs` table)

7. **Delete dead code**
   - Once nothing in the app references the old ad-hoc routes or the pre-refactor module organization, delete them
   - This is the terminal step — do it after everything else is verified

### Exit criteria
- [ ] Every integration lives in `src/lib/sources/{id}/` and implements the `DataSource` interface
- [ ] Every sync goes through `/api/sources/[id]/sync`; old platform-specific routes are either deleted or thin aliases
- [ ] `/invest` runs cleanly on a machine with zero prior local state (after `.env.local` + `npm install`)
- [ ] `/connections` shows honest state for all six platforms (Schwab, Coinbase, Finnhub, Fidelity, Robinhood, banks)
- [ ] CSV upload happens through the UI, not the terminal
- [ ] `/settings` can modify every field of `investment_preferences` without touching SQL
- [ ] Owner uses `/invest` regularly without workarounds

### Explicit non-goals (defer to Phase 2)
- Multi-user anything
- In-app Gemini assistant
- Mobile/PWA
- Plaid / bank integration

---

## Phase 2 — Friend-usable ✅ shipped

**Goal**: A friend can fork the repo, follow `docs/ONBOARDING.md`, and be running their own dashboard with their own accounts end-to-end. Or if we self-host a shared instance, they sign up and get the same.

### In scope
- **Supabase Auth** — email/password + Google OAuth
- **Multi-user data model** — `user_id` on every table, RLS policies, migration script to move the singleton David data to `user_id = <david_uuid>`
- **Per-user credential encryption** — Schwab tokens, Coinbase keys, Finnhub key stored encrypted per user
- **In-app Gemini assistant** — `/assistant` route + floating chat widget
  - Function-calling tools: portfolio summary, holdings, recent syncs, educational helpers
  - System prompt templated per-user with their preferences
  - Disclaimers templated (not LLM-generated) at end of every response
  - Rate-limited (10 req/min per user)
- **Onboarding flow** — `/onboarding` route, progressive disclosure, skippable
- **Documentation** — `docs/ONBOARDING.md` user-facing, `docs/COINBASE_SETUP.md`, `docs/FIDELITY_SETUP.md`, etc.
- **Per-platform integration docs** — how to export CSV, where to get API keys
- **Basic analytics** — how many users, how many syncs, error rates (via Vercel Observability)

### Exit criteria
- [ ] Two friends onboard themselves without needing help beyond `docs/ONBOARDING.md`
- [ ] Their data is provably isolated from each other and from David (RLS verified)
- [ ] Gemini assistant resolves > 60% of connection-troubleshooting questions without hand-off
- [ ] No shared secrets between users; a compromised user doesn't leak others' tokens

### Explicit non-goals (defer to Phase 3)
- Public sign-up without an invite code
- Plaid (still CSV for banks)
- Production-grade monitoring / alerting
- Compliance docs (privacy policy, ToS)

---

## Phase 3 — Public beta (active)

**Goal**: Anyone can sign up at `app.example.com` and trust it with their financial data. We can defend our security posture to a smart skeptic.

### In scope
- **Plaid integration** — bank accounts, credit cards, unified aggregation for platforms without APIs
- **Audit logging** — every credential access and sync trigger logged with user, IP, timestamp
- **Rate limiting** — Cloudflare or middleware, per-user and per-IP
- **Secrets rotation** — automated token refresh, manual rotation flow for API keys
- **Privacy policy + ToS + DPA template** — legal review required
- **Observability** — Datadog/Axiom/Logtail drain, Sentry for frontend errors, alerting on error rate, sync failure clusters
- **Dependency scanning** — Snyk or GitHub Dependabot + CI gating
- **Penetration test** — third-party, before public launch
- **Scale test** — load test 500 concurrent users, fix bottlenecks
- **Plan analysis** — retirement projections ("am I on track for age 65?"), goal setting
- **Education library** — articles + AI-backed explanations for every financial term used in the app

### Exit criteria
- [ ] Pen-test report with zero high-severity findings
- [ ] 50 public-beta users active for 30 days without a security incident
- [ ] P95 sync latency < 3s
- [ ] AI chat accuracy audit: no fabricated recommendations in 100-sample eval

---

## Phase 4 — Scale

**Goal**: The app is sustainable — either self-sustaining (subscription) or clearly on a path there.

### In scope (candidates, pick subset)
- **Shared portfolios** — couples, families
- **Mobile app** — PWA first, native second (React Native?)
- **Tax document prep** — 1099 aggregation, cost-basis lot tracking
- **Trade execution** — maybe via Alpaca or broker APIs that support it; major legal/compliance work
- **Subscription tier** — for Plaid cost recovery, AI token budget, premium features
- **SOC2 Type 1** — if pursuing B2B

### Exit criteria
- [ ] Defined by which subset we pick

---

## Cross-cutting work that happens during every phase

- **Tech debt triage** — each phase leaves some; top of the list for the next phase
- **Security review** — end of each phase, reassess posture
- **Cost monitoring** — Supabase, Vercel, Finnhub, Gemini all have tiers; stay aware
- **Refactor pass** — after each phase ships, one week allocated for cleanup before starting the next
