# Architecture

## System Overview

```
data/raw/{platform}/*.csv    →  scripts/import.ts  →  data/normalized/financial-data.json
                                                              ↓
config/user-profile.json     →  scripts/analyze.ts  →  data/normalized/analysis.json
                                                              ↓
                                                     data/snapshots/snapshot-{date}.json
                                                              ↓
                                                     Next.js Dashboard (localhost:3000)
```

## Directory Structure

```
├── config/                  # User configuration
│   ├── user-profile.json    # Your profile (filled in)
│   └── user-profile.template.json
├── data/
│   ├── raw/                 # Drop CSV exports here
│   │   ├── fidelity/
│   │   ├── schwab/
│   │   ├── robinhood/
│   │   ├── coinbase/
│   │   ├── chase/
│   │   └── citi/
│   ├── normalized/          # Processed data (auto-generated)
│   └── snapshots/           # Historical snapshots (auto-generated)
├── scripts/                 # CLI entry points
│   ├── import.ts            # Parse CSVs → normalized data
│   ├── analyze.ts           # Run analysis → insights + strategy
│   └── update.ts            # Full pipeline (import + analyze)
├── src/
│   ├── app/                 # Next.js pages and API routes
│   ├── components/          # Dashboard UI components
│   └── lib/
│       ├── types.ts         # Unified data schema
│       ├── data-store.ts    # File-based persistence
│       ├── importers/       # Platform-specific CSV parsers
│       └── analysis/        # Analysis and strategy engine
├── prompts/                 # Reusable prompt templates
└── docs/                    # Documentation
```

## Data Flow

1. **Import**: CSV files from each platform are parsed by platform-specific importers into the unified schema (Account, Transaction, Holding types)
2. **Normalize**: Data is deduplicated using deterministic IDs and merged into a single `financial-data.json`
3. **Analyze**: The analysis engine processes normalized data + user profile to produce spending breakdowns, investment allocation, insights, and DCA strategy
4. **Snapshot**: Each analysis run creates a timestamped snapshot for historical tracking
5. **Display**: The Next.js dashboard reads `analysis.json` and renders the financial picture

## Key Design Decisions

- **File-based storage** over databases for portability — zip and share the whole directory
- **Deterministic IDs** from content hashes prevent duplicate imports
- **Incremental imports** — re-running import only adds new data, doesn't duplicate
- **Platform-agnostic schema** — all platforms normalize to the same types
- **Sector-aware analysis** — investment strategy incorporates user's sector preferences
