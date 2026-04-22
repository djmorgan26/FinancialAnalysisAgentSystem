# Financial Analysis Agent System

A multi-user personal finance dashboard that aggregates accounts across brokerages, banks, and crypto exchanges, and produces specific, actionable investment recommendations — not generic advice.

Deployed at [financial-analysis-agent-one.vercel.app](https://financial-analysis-agent-one.vercel.app).

## What it does

- **Aggregates** live data from Schwab (OAuth), Coinbase (CDP), and Finnhub (market data); imports CSVs from Fidelity, Robinhood, Chase, and Citi
- **Analyzes** net worth, allocation, sector exposure, cash drag, and today's movers
- **Recommends** specific buys (`/invest` Claude Code command) and answers questions in-app (Gemini assistant) with read/write access to your preferences
- **Persists** everything per-user in Supabase with RLS; multi-user invite-only today

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · Recharts · deployed on Vercel.

## Quick start (local dev)

```bash
npm install
cp .env.example .env.local   # fill in Supabase, Schwab, Coinbase, Finnhub, Gemini keys
npm run dev                  # http://localhost:3000
```

First run creates your account via the sign-up page and walks you through onboarding (profile, preferences, first connection).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dashboard on `localhost:3000` |
| `npm run import` | CSV (non-Schwab) → Supabase |
| `npm run analyze` | Run analysis pipeline |
| `npm run update` | import + analyze |
| `npm run invest:brief` | Build the `/invest` data bundle |
| `npm run test:coinbase` | Smoke test CDP Ed25519 client |

## Connecting platforms

- **Schwab** — OAuth via `/connections`. Requires a Schwab Individual Developer app; see [docs/SCHWAB_SETUP.md](docs/SCHWAB_SETUP.md).
- **Coinbase** — Paste CDP API key + secret (Ed25519) in `/connections`.
- **Finnhub** — Free API key for live quotes.
- **Fidelity / Robinhood / Chase / Citi** — CSV upload. Export instructions: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Two AI layers

- **`/invest` (Claude Code)** — deep reasoning slash command for the owner; reads Supabase + Finnhub, emits actionable buy/rebalance recommendations.
- **In-app assistant (Gemini)** — `/assistant` route + floating chat. Can read your portfolio/preferences and, on confirmation, write back to `investment_preferences` and `user_profiles`.

Both honor the same disclaimers and the same preferences row.

## Documentation

- [PRD](docs/PRD.md) — product vision, users, feature matrix
- [Architecture](docs/ARCHITECTURE.md) — system design, data model, security posture
- [Roadmap](docs/ROADMAP.md) — shipped phases and what's next
- [Data sources](docs/DATA_SOURCES.md) — CSV export instructions per platform
- [Schwab setup](docs/SCHWAB_SETUP.md) — developer-app registration guide

## Agent tooling

This repo ships a `.claude/skills/` directory with slash commands for common workflows: `verify`, `dev`, `push`. They encode the repo-specific patterns (TEST_USER auth, port-3000 recovery, secret scanning) so Claude Code sessions stay consistent.
