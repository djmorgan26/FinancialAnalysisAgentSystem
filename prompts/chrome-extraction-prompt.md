# Financial Data Extraction — Chrome Cowork Prompt

Copy everything below the line and paste it into a Claude Cowork session with Chrome access.

---

I need you to extract all my financial data from 6 platforms. I am already logged into all of them in Chrome. For each platform, navigate to the URL, extract the data, and save it as CSV files to my project at:

**Project path:** `~/Documents/Repositories/FinancialAnalysisAgentSystem/data/raw/`

## Platform 1: Fidelity
**URL:** https://digital.fidelity.com/ftgw/digital/portfolio/summary

Extract:
- **Positions/Holdings:** Go to the Positions view. For each account (Roth 401k, BrokerageLink), capture: Account Name, Symbol, Description, Quantity, Last Price, Current Value, Cost Basis Total, Total Gain/Loss Dollar, Total Gain/Loss Percent
- **Transactions:** Click into Activity & Orders. Set the date range to maximum. Capture: Run Date, Account, Action, Symbol, Description, Quantity, Price, Amount
- If there's a Download/Export button, use it. Otherwise scrape the table data.
- Save to: `data/raw/fidelity/fidelity-positions.csv` and `data/raw/fidelity/fidelity-transactions.csv`

## Platform 2: Schwab
**URL:** https://client.schwab.com/app/accounts/summary/

Extract:
- **Positions:** Navigate to each account (Investment Account, Roth IRA, Savings). Capture: Symbol, Description, Quantity, Price, Market Value, Cost Basis, Gain/Loss
- **Transactions:** Go to History tab for each account. Set date range to max. Capture: Date, Action, Symbol, Description, Quantity, Price, Fees, Amount
- Save to: `data/raw/schwab/schwab-positions.csv` and `data/raw/schwab/schwab-transactions.csv`

## Platform 3: Robinhood
**URL:** https://robinhood.com/?classic=1

Extract:
- **Holdings:** From the portfolio view, capture all current positions: Symbol, Name, Shares, Average Cost, Current Price, Market Value, Total Return
- **Transaction History:** Go to Account → Statements & History. Capture: Activity Date, Instrument, Description, Trans Code, Quantity, Price, Amount
- Save to: `data/raw/robinhood/robinhood-positions.csv` and `data/raw/robinhood/robinhood-transactions.csv`

## Platform 4: Coinbase
**URL:** https://www.coinbase.com/home

Extract:
- **Portfolio:** Capture all crypto holdings: Asset, Balance, Spot Price, Value
- **Transaction History:** Go to transaction history. Capture: Timestamp, Transaction Type, Asset, Quantity Transacted, Spot Price at Transaction, Subtotal, Total (inclusive of fees), Notes
- Save to: `data/raw/coinbase/coinbase-portfolio.csv` and `data/raw/coinbase/coinbase-transactions.csv`

## Platform 5: Chase
**URL:** https://secure.chase.com/web/auth/dashboard#/dashboard/overview

Extract:
- **Account Balances:** Capture all accounts and their current balances
- **Credit Card Transactions:** Click into the credit card account. Download all available activity. Capture: Transaction Date, Post Date, Description, Category, Type, Amount
- Save to: `data/raw/chase/chase-transactions.csv`

## Platform 6: Citi
**URL:** https://online.citi.com/US/ag/dashboard/credit-card

Extract:
- **Credit Card Balance:** Capture current balance, available credit, minimum payment due
- **Transactions:** View all transactions. Capture: Status, Date, Description, Debit, Credit
- Save to: `data/raw/citi/citi-transactions.csv`

## CSV Format Requirements

Each CSV must have a header row. Use these exact column names matching the platform's standard export format:

**Fidelity positions:** `Account Name,Symbol,Description,Quantity,Last Price,Current Value,Cost Basis Total,Total Gain/Loss Dollar,Total Gain/Loss Percent`

**Schwab positions:** `Symbol,Description,Quantity,Price,Market Value,Cost Basis,Gain/Loss $,Gain/Loss %`

**Schwab transactions:** `Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount`

**Robinhood:** `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount`

**Coinbase:** `Timestamp,Transaction Type,Asset,Quantity Transacted,Spot Price at Transaction,Subtotal,Total (inclusive of fees),Notes`

**Chase:** `Transaction Date,Post Date,Description,Category,Type,Amount`

**Citi:** `Status,Date,Description,Debit,Credit`

## After Extraction

Once all CSVs are saved, run this in the terminal:
```bash
cd ~/Documents/Repositories/FinancialAnalysisAgentSystem
npm run update
```

This will import all CSVs, run the analysis, and generate the dashboard. Then open http://localhost:3000 to see the results.

## Important Notes
- I am already logged in to all platforms — just navigate directly
- Prefer using the platform's built-in Export/Download CSV button if one exists
- If you need to scrape tables, make sure to get ALL rows, not just the visible ones (scroll or paginate)
- For transaction history, get the maximum date range available
- Dollar amounts should include the raw number (e.g., `1234.56` not `$1,234.56`) — but either format works, the importers handle both
- If a platform shows a security challenge or 2FA prompt, stop and tell me
