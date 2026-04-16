# Data Sources — CSV Export Instructions

## Fidelity (Roth 401k, BrokerageLink)

1. Go to [Fidelity Portfolio Summary](https://digital.fidelity.com/ftgw/digital/portfolio/summary)
2. Click **"Download"** (top right of positions table)
3. Select **CSV** format
4. Save to `data/raw/fidelity/`

**Expected columns:** Account Name, Symbol, Description, Quantity, Last Price, Current Value, Cost Basis Total, etc.

## Schwab (Investment, Roth IRA, Savings)

1. Go to [Schwab Accounts](https://client.schwab.com/app/accounts/summary/)
2. Navigate to **History** tab
3. Set date range to max
4. Click **Export** → **CSV**
5. For positions: go to **Positions** tab → **Export**
6. Save to `data/raw/schwab/`

**Expected columns:** Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount

## Robinhood (Stocks, ETFs)

1. Go to [Robinhood](https://robinhood.com)
2. Click **Account** → **Statements & History**
3. Click **Download CSV** for account history
4. Save to `data/raw/robinhood/`

**Expected columns:** Activity Date, Process Date, Settle Date, Instrument, Description, Trans Code, Quantity, Price, Amount

## Coinbase (Cryptocurrency)

1. Go to [Coinbase](https://www.coinbase.com/home)
2. Navigate to **Taxes** → **Documents**
3. Click **Generate Report** → **Transaction History**
4. Download CSV
5. Save to `data/raw/coinbase/`

**Expected columns:** Timestamp, Transaction Type, Asset, Quantity Transacted, Spot Price at Transaction, Subtotal, Total (inclusive of fees), Notes

## Chase (Credit Card)

1. Go to [Chase Dashboard](https://secure.chase.com/web/auth/dashboard)
2. Click on credit card account
3. Click **Download account activity**
4. Select **CSV** and date range
5. Save to `data/raw/chase/`

**Expected columns:** Transaction Date, Post Date, Description, Category, Type, Amount

## Citi (Credit Card)

1. Go to [Citi Dashboard](https://online.citi.com/US/ag/dashboard)
2. Click on credit card
3. Navigate to **View Transactions**
4. Click **Download** → **CSV**
5. Save to `data/raw/citi/`

**Expected columns:** Status, Date, Description, Debit, Credit

## Tips

- Export **maximum date range** available for first import
- For subsequent updates, export only the new period — the system deduplicates automatically
- Name files descriptively (e.g., `fidelity-positions-2026-04.csv`, `chase-activity-2026-q1.csv`)
- Multiple CSVs per platform are fine — they all get merged
