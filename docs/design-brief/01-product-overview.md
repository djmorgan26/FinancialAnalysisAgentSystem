# Product Overview

## Vision

A personal finance dashboard that knows everything about your money across every platform and gives you specific, actionable investment recommendations — not generic advice. Built so the owner uses it daily, friends can use it after a short onboarding, and eventually anyone can sign up.

**The question it answers**: *"What should I invest in today, where, and how much?"* — answered with real numbers from your real accounts in under 30 seconds.

## Users

### Primary — the owner (power user)
- Comfortable with developer tools; uses a terminal
- Multiple brokerages and a crypto wallet
- Wants **density, speed, real numbers**
- Uses Claude Code locally for deep analysis via a `/invest` slash command
- Will sync manually when something feels off

### Secondary — a friend (self-hosted)
- Has 2-3 accounts (Schwab, maybe Robinhood, maybe a bank)
- Comfortable with "paste an API key" but not with editing SQL or reading code
- Wants **clear guidance**: what's set up, what isn't, what to do next
- No Claude Code; relies on the in-app AI assistant for help

### Tertiary — a public user (Phase 3, future)
- Out of scope for this design pass, but don't paint ourselves into a corner

## Core jobs the product does

1. **Aggregate portfolio data** across platforms into one picture — live when possible, CSV when not
2. **Surface recommendations** with ticker + dollar amount + target account, grounded in the user's stated preferences
3. **Track state** — what's connected, what's stale, what's failed, what's never been set up
4. **Explain** — what a term means, why a recommendation was made, how to connect a platform
5. **Remember** — investment preferences, contribution targets, prior analyses, historical snapshots

## Integration taxonomy (the key "what's supported" story)

Every data source falls into one of three tiers. The UI shows this honestly.

### Tier 1 — Live API
- **Charles Schwab** (OAuth) — brokerage, Roth IRA, checking, savings. Accounts, balances, holdings, cost basis. No transactions yet.
- **Coinbase** (CDP API key) — crypto wallets, spot-price-derived USD value. No cost basis.
- **Finnhub** (API key) — market data: real-time quotes, news, sentiment. Not a portfolio source.

### Tier 2 — CSV import (manual export + upload)
- **Fidelity** — 401(k) + BrokerageLink. Positions, balances, cost basis.
- **Robinhood** — brokerage. Positions, avg cost.

### Tier 3 — Not yet supported (transparent about this)
- **Chase** (credit card) — requires Plaid or bank-screen-scrape. "Coming soon."
- **Citi** (credit card) — same.
- **Bank checking/savings** — same.

## Feature tiers

### Phase 1 (this design pass includes)
- Connections page (all sources, honest status)
- CSV drag-drop upload with preview
- Dashboard (net worth, daily movers, allocation, top positions)
- Deep analysis page (sector breakdown, account detail, holdings table)
- Settings: profile, investment preferences, account prefs
- Snapshot history (line chart of net worth over time)
- Sync log viewer (troubleshooting)
- `/invest` is Claude-Code-only for Phase 1 (not in the in-app UI)

### Phase 2 (include in this design pass)
- Sign-in (Supabase Auth)
- Multi-user — per-user data isolation (no shared dashboards)
- Onboarding flow (profile, first connection, first preferences)
- In-app AI assistant (Gemini) — chat with tools
- Per-platform setup guides with step-by-step walkthroughs inside the app

### Phase 3+ (exclude from this design pass)
- Plaid integration
- Public signup landing page
- Shared portfolios
- Mobile app
- Tax tools

## Non-goals (explicit, so the design doesn't drift)

- **Not a trading platform.** No order-entry UI. Users execute trades in their broker.
- **Not a budgeting app.** No grocery-level transaction categorization. Investment-decision context only.
- **Not tax software.** We flag TLH candidates; we don't prepare returns.
- **Not a fiduciary/advisor.** All recommendations are informational. Tone and disclaimers reflect this.

## Success criteria

- A user with zero connections can go from landing → useful dashboard in under 10 minutes
- A connections page view communicates state at a glance (no need to click into each card to understand what's wrong)
- A returning user's daily check-in is single-click from landing
- The AI assistant resolves common connection errors without escalation (Phase 2)
- Every recommendation surface carries the legal disclaimer, templated (not AI-generated)

## What makes this design different from "another finance app"

- **Data-dense without looking like a Bloomberg terminal.** Numbers matter, but so does breathing room and clarity.
- **Mixes live and stale data transparently.** Other apps hide the CSV-based sources behind "sync in progress" — we show exactly when it was last refreshed.
- **AI is integrated, not bolted on.** The assistant has tools; it reads the user's real data; its answers reference specific holdings.
- **Solo-first, multi-user-ready.** The design must work beautifully with one user and scale to many without re-design.
