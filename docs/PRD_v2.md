# Product Requirements — v2.0

**Status**: Draft | **Owner**: David Morgan | **Last updated**: 2026-04-22

This is the non-technical product PRD. For the technical architecture see [ARCHITECTURE_v2.md](./ARCHITECTURE_v2.md). For phasing and priorities see [ROADMAP.md](./ROADMAP.md).

## Vision

A personal finance dashboard that knows everything about your money across every platform and gives you specific, actionable investment recommendations — not generic advice. Built so the owner uses it daily, their friends can use it after a short onboarding, and eventually anyone can sign up.

**One sentence**: "What should I invest in today, and where, and how much?" — answered with real numbers from your real accounts, in under 30 seconds.

## Users

| Persona | Scale | Needs | What they care about |
|---|---|---|---|
| **Owner (David)** | 1 | Power tools, everything wired up, `/invest` via Claude Code | Speed of insight, data accuracy, exact recommendations |
| **Friends (self-hosted)** | 2-20 | Clone repo, follow onboarding, connect their own accounts | Clear setup instructions, visible status of connections, in-app help |
| **Public (hosted)** | 100+ | Sign up, connect accounts in minutes, secure multi-tenant | Privacy, security, trust — "why should I let this app see my money?" |

## Core use cases (ranked)

1. **Daily/weekly investment check-in** — see portfolio snapshot, today's movers, cash deployable, get a specific buy list with dollar amounts.
2. **Tax-loss harvesting & rebalancing** — surface TLH candidates, concentration flags, core-allocation drift.
3. **Long-term planning** — contribution tracking (Roth IRA, 401k), retirement projections, "am I on track?"
4. **New integration onboarding** — connect a new brokerage/bank, understand what data comes in and what doesn't.
5. **Financial learning** — ask the in-app AI about tax concepts, market terms, "what does X mean?"

## Non-goals (explicit)

- **Not a trading platform.** We surface recommendations; user executes in their brokerage of choice.
- **Not a budgeting app.** We track investment decisions, not every coffee purchase. Credit card data (when added) is for net-worth and debt context, not transaction categorization at grocery-level.
- **Not tax software.** We flag TLH candidates but don't prepare returns.
- **Not a legal/fiduciary advisor.** All recommendations are informational. Surfacing this in UX is a requirement.

## Feature matrix — what's supported and what isn't

The UI's Connections page must make this transparent. Users should never wonder "is this working or not?"

### Data integrations

| Platform | Type | Tier | What you get | What's missing |
|---|---|---|---|---|
| **Charles Schwab** | Brokerage/IRA | Live API (OAuth) | Positions, balances, cost basis, live refresh | Transactions (deferred — requires date range) |
| **Coinbase** | Crypto | Live API (CDP) | Wallet balances, spot prices, USD value | No cost basis (CDP read-only limitation) |
| **Finnhub** | Market data | Live API (key) | Real-time quotes, news | — |
| **Fidelity** | 401(k), BrokerageLink | CSV import | Positions, balances, cost basis | No live refresh; manual export every sync |
| **Robinhood** | Brokerage | CSV import | Positions, balances, avg cost | No live refresh; no transactions in export |
| **Chase** | Credit card | **Not yet** | — | Requires Plaid ($). Planned Phase 2. |
| **Citi** | Credit card | **Not yet** | — | Same as Chase. |
| **Bank checking/savings** | Bank | **Not yet** | — | Same. Planned Phase 2. |

**UI promise**: every integration in this table gets a card on `/connections` with one of four states: `Connected`, `CSV — needs re-import`, `Not set up`, `Coming soon`. The state and the "what's missing" column are shown verbatim so users aren't surprised.

### AI layers

| Layer | Audience | What it does | When it's available |
|---|---|---|---|
| **Claude Code `/invest`** | Power users (devs) | Deep investment analysis, slash command, reads live data + preferences | Only with Claude Code installed |
| **In-app Gemini assistant** | All users | Onboarding, troubleshooting, finance Q&A, light analysis, "help me connect X" | Always, hosted in the app |

### Analysis features

| Feature | Phase 1 (MVP) | Phase 2 | Phase 3 |
|---|---|---|---|
| Net-worth dashboard | ✅ | | |
| Asset allocation chart | ✅ | | |
| Sector exposure | ✅ | | |
| Daily movers | ✅ | | |
| `/invest` recommendations | ✅ | | |
| TLH candidate flags | ✅ | | |
| Snapshot history | ✅ | | |
| Contribution tracking (Roth, 401k) | ✅ | | |
| In-app Gemini chat | | ✅ | |
| Goal-based planning ("retire at X") | | ✅ | |
| Spending analysis | | ✅ (requires CC integration) | |
| Tax document prep | | | ✅ |
| Multi-user accounts | | | ✅ |
| Shared portfolios (spouse) | | | ✅ |

## User flows

### 1. Onboarding (new user, first run)

```
Landing → "What is this?" explainer → Sign in (Phase 2) → Create profile (name, age, income)
  → Connection wizard
      → "Connect Schwab?" [Yes: OAuth] [Skip]
      → "Connect Coinbase?" [Yes: paste CDP key] [Skip]
      → "Upload Fidelity CSV?" [Yes: drag-drop] [Skip]
      → "Upload Robinhood CSV?" [Yes: drag-drop] [Skip]
      → "Set up Finnhub for market data?" [Yes: paste API key] [Skip — fallback prices only]
  → Investment preferences
      → Risk tolerance, sector bias, contribution targets, core allocation %
  → First analysis auto-runs → Dashboard
  → AI assistant pop-up: "I'm your dashboard assistant — ask me anything"
```

Skippable at any step. The dashboard works with zero connections, just shows "Connect something to see data."

### 2. Daily check-in (returning user)

```
Dashboard → sees net-worth delta, top movers → clicks "Get today's brief"
  → Runs /invest (if power user) OR asks Gemini "what should I do today?"
  → Gets action list with $ amounts and accounts
  → Optionally executes trades in broker
  → Returns, logs "Done" → snapshot saved
```

### 3. New integration (after onboarding)

```
Dashboard → /connections → sees "Coinbase — Not set up" card
  → Clicks "Set up" → inline instructions (with screenshots in Phase 2)
  → Pastes key → "Test connection" button → green checkmark
  → Auto-triggers first sync → returns to dashboard with new data
  → If connection fails → Gemini assistant offers to help diagnose
```

### 4. CSV refresh (Fidelity, Robinhood)

```
/connections → Fidelity card shows "CSV — last imported 9 days ago"
  → Click "Upload new CSV" → drag-drop
  → Upload parsed → preview diff ("3 new positions, 2 removed, $412 balance change")
  → Confirm → normalized → pushed to Supabase → dashboard refreshes
```

### 5. Ask the AI assistant

```
Anywhere in app → chat icon bottom-right → opens Gemini sheet
  → "What's a Roth IRA?" → educational answer
  → "Why is SMH on my watchlist?" → pulls from preferences + explains
  → "Help me connect my Fidelity account" → step-by-step walkthrough
  → "Should I sell NVDA?" → reads portfolio, answers with disclaimer
```

## Success metrics

- **Time from first visit → first useful insight**: < 10 minutes
- **Integration setup success rate**: > 80% complete on first try (measured via `/connections` state after 24hr)
- **`/invest` run frequency**: owner runs ≥ 2x/week (proxy for usefulness)
- **Data freshness**: Live-API accounts ≤ 24hr stale, CSV accounts ≤ 30 days stale (with warning)
- **In-app AI usefulness** (Phase 2+): > 60% of user questions get a satisfactory answer without needing to re-ask

## Compliance & disclaimers

- Every recommendation surface (brief, AI chat, dashboard cards) must carry **"Informational only — not financial, tax, or legal advice"**.
- No user-to-user financial advice; the AI never says "you should do X" — it says "one option is X, based on your stated preferences." Wording matters.
- Privacy policy and terms of service required before Phase 3 (public). Not required for solo/self-hosted.

## Open questions

- [ ] Do we want the Gemini assistant to be able to *trigger syncs* / *write to Supabase* on user request, or read-only? (Security implications if multi-user.)
- [ ] Plaid vs. manual bank entry for Phase 2 — Plaid costs per-connection per-month; might be worth it or might be overkill for friends-scale.
- [ ] Should CSV re-imports be flagged in UI with "it's been X days, you might want to refresh"? Nudge or silent?
- [ ] Mobile app — PWA or native? Defer decision until Phase 3.
