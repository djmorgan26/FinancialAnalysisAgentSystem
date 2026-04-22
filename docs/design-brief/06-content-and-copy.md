# Content & Copy

Real sample data, copy tone, and legal templates. So wireframes show realistic content, not Lorem ipsum.

---

## Sample portfolio (use this in every wireframe that needs data)

### Portfolio summary
- **Total net worth**: $184,899
- **Today's change**: +$2,067 (+1.16%)
- **Weekly change**: +$4,512 (+2.5%)
- **Cash deployable**: $23,324
- **Core allocation**: 14.1% (target ≥ 50%)
- **Roth IRA room remaining**: $3,000 (of $7,000 annual limit, $4,000 already contributed)

### Accounts
| Name | Platform | Type | Balance | Positions | Sync status |
|---|---|---|---|---|---|
| Individual Brokerage | Schwab | Brokerage | $82,380 | 27 | Connected, synced 2h ago |
| Roth Contributory IRA | Schwab | Roth IRA | $21,404 | 10 | Connected, synced 2h ago |
| BrokerageLink | Fidelity | Brokerage (in 401k) | $12,703 | 8 | CSV, 7 days ago |
| AT&T Retirement 401k | Fidelity | Roth 401(k) | $28,635 | 2 | CSV, 7 days ago |
| Robinhood Brokerage | Robinhood | Brokerage | $34,666 | 26 | CSV, 7 days ago |
| Coinbase | Coinbase | Crypto | $5,374 | 3 | Connected, synced 5 min ago |

### Top 10 holdings (aggregated across accounts)
| Symbol | Value | % of portfolio | Avg cost | Today's move |
|---|---:|---:|---:|---:|
| MSFT | $13,430 | 7.3% | $418 | +1.7% |
| VOO | $20,344 | 11.0% | $550 | +0.8% |
| QQQM | $10,790 | 5.8% | $210 | +1.4% |
| AT&T 2065 Target Date | $21,356 | 11.5% | — | +0.6% |
| SWVXX (money market) | $21,035 | 11.4% | $1.00 | — |
| GOOG + GOOGL | $11,341 | 6.1% | $262 | +1.7% |
| NVDA | $8,238 | 4.5% | $158 | +0.9% |
| AMZN | $7,513 | 4.1% | $201 | +1.6% |
| AT&T Shares Fund | $7,279 | 3.9% | — | -3.5% |
| QBTS (D-Wave) | $6,822 | 3.7% | $14.47 | +1.4% |

### Recommendation brief example (for action-list wireframes)
1. **CONTRIBUTE $3,000 to Roth IRA, then BUY $3,869 VOO in Roth IRA** — fills remaining 2026 Roth room plus deploys idle cash. VOO because broad-market compounding belongs in the tax-free wrapper.
2. **BUY $5,500 VOO in Schwab Brokerage** — biggest single move toward core allocation target. Cash drag is the most fixable issue.
3. **BUY $2,500 VHT in Schwab Brokerage** — healthcare exposure is 0.4% vs stated bias; VHT is near cost basis.
4. **BUY $1,500 SMH in Schwab Brokerage** — semiconductor ETF; bias-list underweight at 1.2%.
5. **HARVEST losses in Robinhood** — sell ARKG (−$110) and SNOW (−$112); redeploy after 31 days.

### Sample flags
- Core allocation 14.1% vs min 50%. Deficit: $63,797
- QQQM unrealized loss $-113 (-15%) in taxable — possible TLH
- Brokerage has $21,035 above cash floor — deployable
- Roth IRA has $869 uninvested
- Roth IRA has $3,000 of contribution room remaining

### Sample sync log entries
| Time | Source | Status | Message |
|---|---|---|---|
| 3:42 PM | schwab | ✓ success | Synced 2 accounts, 39 positions |
| 3:40 PM | coinbase | ✓ success | Synced 1 account, 3 crypto positions |
| 12:15 PM | schwab | ✗ error | Token refresh failed: expired |
| 11:00 AM (7d ago) | fidelity | ✓ success | Imported 11 positions from CSV |

---

## Copy tone

### Voice
- **Direct** — no hedging. "Your core allocation is below target" not "You may want to consider whether your core allocation..."
- **Specific** — numbers and names, not categories. "Buy $5,500 VOO in Schwab Brokerage" not "add to your index position."
- **Calm** — never alarmed. Never gamified. A market down day is not an emergency.
- **Adult** — the user is competent; don't over-explain.
- **Honest** — surface limitations explicitly. "This is CSV data, last imported 9 days ago" not "Up to date."

### What not to say
- "Oops!" "Uh-oh!" (never cheerful about failures)
- "We're working hard to..." (don't narrate; fix it)
- "Just click here!" "Easy peasy!" (condescending)
- "Based on your income and risk tolerance, you may want to consider..." (too hedged — show the specific recommendation, cite the reason in one line)

### Example rewrites

| Bad | Good |
|---|---|
| "Oh no, we couldn't sync your Schwab account!" | "Schwab needs reauthentication. Token expired 2 days ago." |
| "You might want to think about maxing your Roth" | "You have $3,000 of Roth room remaining this year." |
| "Great job staying invested!" | (nothing — don't congratulate routine actions) |
| "Your portfolio is performing well!" | "Portfolio is +2.5% this week." |
| "Click here to get started" | "Connect your first account." |

---

## Legal disclaimer templates

Use these verbatim. Do not let the AI rephrase them.

### Short (inline, end of recommendation blocks)
```
Informational only — not financial, tax, or legal advice.
```

### Medium (footer of dashboards, analysis pages)
```
The information on this page is for educational purposes only. It is not
personalized financial, tax, or legal advice. Consult a licensed advisor
before making decisions that affect your finances.
```

### Long (first-time modal when user enables recommendation features; periodic reminder)
```
This dashboard aggregates data from the accounts you've connected and
surfaces informational recommendations based on preferences you've set.

These are not personalized financial advice, tax guidance, or legal
recommendations. Market conditions change. The creators of this app
are not licensed financial advisors and cannot be held responsible for
outcomes from actions you take based on what you see here.

Before making significant financial decisions — buying, selling,
rebalancing, tax-loss harvesting, changing your retirement
contributions — consult a licensed professional.
```

### AI assistant per-message disclaimer
Every assistant response that includes a recommendation (action, trade, allocation change) ends with:
```
—— 
I'm providing this as informational context based on your stated
preferences and current portfolio. This isn't personalized financial
advice. If you're making a significant decision, talk to a licensed
advisor.
```

---

## Platform setup copy

### Schwab (OAuth)
**Card subtitle**: "Connect your Schwab accounts with one click (OAuth). Live syncs pull positions, balances, and cost basis in real time. Reauthenticate every 7 days (Schwab's limit, not ours)."

**Setup CTA**: "Connect with Schwab"

### Coinbase (CDP API key)
**Card subtitle**: "Paste an API key from Coinbase Developer Platform. Read-only — we never have permission to trade. Gives you live crypto balances and USD values."

**Setup steps**:
1. Go to [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) and create an API key
2. Set permissions to "Portfolio: Primary View" (read-only)
3. Paste the Key ID and Secret below
4. Click "Test connection"

### Finnhub (market data, API key)
**Card subtitle**: "Free market data for real-time prices, news, and sentiment. Get a key from finnhub.io (free tier works fine for personal use)."

### Fidelity (CSV)
**Card subtitle**: "No public API. Export a CSV from Fidelity quarterly (or whenever you want fresh data) and upload it here."

**Setup steps**:
1. Log in to fidelity.com
2. Go to Accounts & Trade → Portfolio
3. Click the "Download" button above the positions table
4. Upload the CSV below

### Robinhood (CSV)
**Card subtitle**: "No official API for retail users. Export the positions CSV and upload it here."

**Setup steps**:
1. Log in to robinhood.com
2. Go to Account → Statements & History → Activity
3. Export positions as CSV
4. Upload the CSV below

### Chase / Citi / Banks — "Coming soon"
**Card subtitle**: "Bank and credit card support is planned. We're evaluating Plaid for secure aggregation. For now, you'll have to track these separately."

---

## Empty state copy (examples)

**Dashboard, zero connections**:
> **Let's connect your first account.**
> The dashboard comes alive once you connect a brokerage, crypto wallet, or retirement account. Pick one below to get started.

**Sync log, no entries**:
> **No sync history yet.**
> Once you connect and sync an account, every sync attempt (success or failure) shows up here.

**Snapshots / history, no data**:
> **No snapshots yet.**
> Snapshots are taken automatically when you run an analysis. Come back after your first sync.

**Holdings table filtered to nothing**:
> **No holdings match these filters.**
> Try clearing filters or widening your search.

---

## Key terms (consistent vocabulary)

| Term | Meaning in this app | Don't say |
|---|---|---|
| Account | One brokerage/bank/crypto container (e.g., "Schwab Roth IRA") | "Portfolio" (ambiguous) |
| Holding / Position | A specific ticker held in an account | "Asset" (too broad) |
| Platform / Source | A data provider (Schwab, Coinbase, Fidelity) | "Broker" (not always a broker) |
| Connected | Live API is healthy and syncing | "Linked" (used by banking apps) |
| CSV-based | Data comes from periodic CSV import | "Manual" (sounds punitive) |
| Net worth | Sum of all assets minus liabilities | "Wealth" "Balance" (imprecise) |
| Core allocation | % of portfolio in broad-market index funds | "Base" "Foundation" (not standard) |
| Tax-loss harvest (TLH) | Realizing a loss to offset gains/income | Avoid slang |
| Recommendation | An informational suggested action | "Advice" (legal concern) |
| Brief | The output of running `/invest` | "Report" (too formal) |

---

## Error message templates

Same tone as the rest of the app: specific, calm, actionable.

| Situation | Message |
|---|---|
| Schwab token expired | "Schwab needs reauthentication. Your token expired. Reconnect to resume syncing." |
| Coinbase key rejected | "Coinbase rejected the API key. Double-check the Key ID and Secret on portal.cdp.coinbase.com." |
| CSV parse failure | "Couldn't parse this CSV. Row 12, column 'Shares' has a value that doesn't look like a number. Try re-exporting." |
| Network / timeout | "Couldn't reach [service]. Check your connection and try again." |
| Sync succeeded with no changes | "Synced. No changes since last run." (informational, not error) |
| Gemini rate-limited (Phase 2) | "I'm at my request limit for the moment. Try again in about a minute." |

---

## First-run welcome copy (S11)

**Headline**: See everything. Decide faster.

**Subhead**: One dashboard for every brokerage, every crypto wallet, every retirement account — plus actionable recommendations based on what you actually own.

**Three-card summary**:
1. **Connect your accounts** — Schwab, Coinbase, Fidelity, Robinhood, and more. Live when possible, CSV when not. We're honest about which is which.
2. **Get specific recommendations** — Not "consider adding to tech." Actual dollar amounts, in specific accounts, grounded in your preferences.
3. **Ask anything** — The in-app assistant knows your portfolio and can help with connections, finance questions, and planning.

**CTA**: Get started

**Small link**: Not ready? Explore with sample data
