# Financial Analysis Agent System

Personal finance aggregation, analysis, and strategy dashboard.

## Quick Reference

- **Stack:** Next.js 16, TypeScript, Tailwind CSS, Recharts
- **Data:** File-based JSON in `data/`, CSV imports from 6 platforms
- **Config:** `config/user-profile.json`

## Commands

```bash
npm run dev          # Start dashboard at localhost:3000
npm run import       # Import CSVs from data/raw/{platform}/
npm run analyze      # Run analysis pipeline
npm run update       # Full pipeline: import → analyze
```

## Key Paths

- `src/lib/types.ts` — Unified data schema (accounts, transactions, holdings)
- `src/lib/importers/` — Platform CSV parsers (fidelity, schwab, robinhood, coinbase, chase, citi)
- `src/lib/analysis/` — Analysis engine (spending, investments, insights, strategy)
- `src/lib/data-store.ts` — File-based persistence layer
- `config/user-profile.json` — User profile and preferences
- `data/raw/{platform}/` — Drop CSV exports here
- `data/normalized/` — Processed data (auto-generated)

## Docs

- `docs/ARCHITECTURE.md` — System design and data flow
- `docs/DATA_SOURCES.md` — CSV export instructions per platform
- `prompts/analysis-template.md` — Reusable prompt template for new users
