# Financial Analysis Agent System

A self-contained personal finance intelligence system that aggregates financial data from multiple platforms, analyzes spending and investments, and produces a dashboard with actionable strategy.

## What It Does

- **Aggregates** data from Fidelity, Schwab, Robinhood, Coinbase, Chase, and Citi
- **Computes** net worth, cash flow, savings rate, and spending breakdowns
- **Analyzes** investment allocation, sector exposure, and portfolio overlaps
- **Generates** DCA strategy, budget targets, and actionable insights
- **Displays** everything in a clean, dark-themed dashboard

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure your profile
cp config/user-profile.template.json config/user-profile.json
# Edit config/user-profile.json with your details

# 3. Export CSVs from your financial platforms
# See docs/DATA_SOURCES.md for step-by-step instructions
# Drop CSVs into data/raw/{platform}/

# 4. Run the full pipeline
npm run update

# 5. Start the dashboard
npm run dev
# Open http://localhost:3000
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run update` | Full pipeline: import CSVs → analyze → generate insights |
| `npm run import` | Import/merge CSVs from `data/raw/` |
| `npm run analyze` | Run analysis on existing data |
| `npm run dev` | Start the dashboard |

## Supported Platforms

| Platform | Account Types | Data |
|----------|--------------|------|
| Fidelity | Roth 401(k), BrokerageLink | Positions, transactions |
| Schwab | Brokerage, Roth IRA, Savings | Positions, transactions |
| Robinhood | Stocks, ETFs | Positions, transactions |
| Coinbase | Crypto | Transactions, holdings |
| Chase | Credit card | Transactions |
| Citi | Credit card | Transactions |

## For New Users

1. Copy `config/user-profile.template.json` → `config/user-profile.json`
2. Fill in your profile, accounts, expenses, and preferences
3. See `prompts/analysis-template.md` for a guided template
4. Follow `docs/DATA_SOURCES.md` for CSV export instructions
5. Run `npm run update` and open the dashboard

## Portability

This system is fully self-contained. To share it:

```bash
# Exclude node_modules and personal data
zip -r finance-system.zip . -x "node_modules/*" "data/raw/*" "data/normalized/*" "data/snapshots/*" "config/user-profile.json"
```

The recipient drops it in their workspace, fills in their config, adds their CSVs, and runs `npm run update`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design and data flow
- [Data Sources](docs/DATA_SOURCES.md) — CSV export instructions per platform
- [Analysis Template](prompts/analysis-template.md) — Guided prompt template
