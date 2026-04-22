# Screen Inventory

Every screen the app needs, with purpose, content, actions, and states. Screens are referenced by ID in the flows document.

## Global shell

Every authenticated screen sits inside a shared shell:

- **Top bar**: app logo/name, current net worth (live, small), sync status indicator (one of: `all fresh`, `N stale`, `M errors`), user menu
- **Left nav** (desktop): Dashboard, Connections, Analysis, History, Assistant, Settings
- **Floating AI widget** (bottom-right, Phase 2): chat icon, badge for unread
- **Disclaimer footer** (subtle): "Informational only — not financial, tax, or legal advice."

Empty/loading/error patterns apply consistently across all screens — see `04-patterns.md`.

---

## S01 — Dashboard (`/`)

**Purpose**: The daily landing. Answers "how am I doing?" at a glance and surfaces the single next action.

**Who sees it**: Every returning user, every day.

**Content zones** (top to bottom):

1. **Hero metric row**
   - Net worth (big number), today's change in $ and %, this week's change
   - Small timestamp: "Last synced 2 hours ago"
2. **Next action card** (prominent, above fold)
   - 1-2 sentences summarizing the most important move (e.g., "You have $3,000 of Roth IRA room remaining — fill it before Dec 31.")
   - Primary CTA button ("See today's brief" → runs `/invest` for power users; opens AI chat for friends)
3. **Account summary row** — 4-6 cards, one per account, showing:
   - Account name, balance, today's delta, position count, freshness badge
4. **Allocation snapshot** — two charts side-by-side:
   - Asset allocation (donut: equities / cash / crypto / fixed income)
   - Sector exposure (horizontal bars: tech, healthcare, etc.)
5. **Top positions table** — top 10 holdings aggregated across accounts, with $, %, and today's % change
6. **Flags / nudges** — 2-4 items from the brief's `flags` array (e.g., "Core allocation 22% vs target 50%", "Roth IRA has $869 uninvested")

**Actions**:
- "Sync all" button (triggers every connected source)
- Each account card → opens account detail modal
- Each nudge → opens relevant page (Settings, Analysis, Connections)

**States**:
- **Empty (no connections)** — replaces hero with "Connect your first account" card that leads to Connections page
- **Loading** — skeleton shimmer per zone
- **Stale** — banner at top: "Some data hasn't synced recently" with "Sync all" action

---

## S02 — Connections (`/connections`)

**Purpose**: Show status of every data integration, honestly. One card per platform.

**Who sees it**: Users managing integrations; troubleshooters.

**Content**: Sections grouped by state:

1. **Connected (Tier 1, live)** — Schwab, Coinbase, Finnhub cards
2. **CSV-based (Tier 2)** — Fidelity, Robinhood cards
3. **Available to set up** — anything not yet configured
4. **Coming soon (Tier 3)** — Chase, Citi, banks — grayed out with "Planned for a future release"

**Per-card content**:
- Platform name + logo
- Subtitle: what accounts are covered (e.g., "Individual, Roth IRA, Checking")
- Status badge (see patterns)
- Metadata: "Token valid until Apr 29 — reauth every 7 days" / "Last imported 4 days ago" / "Not set up"
- Action button: `Sync Now` / `Reauthenticate` / `Upload CSV` / `Set Up` / (disabled for "Coming soon")

**Actions**:
- Set Up → opens S03 (connection detail)
- Sync Now → triggers sync, shows inline toast
- Upload CSV → opens S04 (upload modal)

**States**:
- At least one source errored → top banner summarizing the errors, linking to affected cards
- Reauth needed → orange card styling + prominent CTA

---

## S03 — Connection detail (`/connections/[id]`)

**Purpose**: Set up a platform, view credentials status, see sync history for that platform.

**Who sees it**: A user configuring or troubleshooting a single source.

**Content zones**:
1. **Header**: platform logo, name, current status
2. **Setup form** — varies by source type:
   - OAuth (Schwab): "Connect with Schwab" button; shows expiry + refresh cadence once connected
   - API key (Coinbase, Finnhub): input fields (key, secret where applicable), "Test connection" button, validation feedback
   - CSV (Fidelity, Robinhood): instructions for exporting from that platform + drag-drop upload
3. **What this gives you**: bullet list of data types synced (accounts, holdings, transactions, etc.)
4. **What's missing / limitations**: honest callout (e.g., "Coinbase CDP doesn't provide cost basis")
5. **Recent sync log** — last 5 sync attempts with timestamp, status, message, position counts
6. **Danger zone**: disconnect / delete stored credentials

**Actions**: Save, Test, Sync now, Disconnect

**States**:
- Never set up → just the setup form
- Connected, healthy → all zones populated, green state
- Connected, errored → red banner at top with the error message, sync log visible for debugging

---

## S04 — CSV upload modal

**Purpose**: Import a positions CSV from a Tier 2 platform (Fidelity, Robinhood).

**Triggered from**: S02 card, S03 detail page, onboarding flow.

**Content**:
1. **Drag-drop zone** (full-width) — file picker fallback
2. **Instructions** — platform-specific (e.g., "Export 'Positions' from Fidelity → Accounts & Trade → Portfolio → Download")
3. **Parsed preview** (after drop) — first 5 rows of parsed data, column mapping if ambiguous
4. **Diff against current state** (if previously imported):
   - "3 new positions, 2 removed, $412 balance change"
5. **Confirm / Cancel** buttons

**States**:
- Parse error — show which row/column failed + raw CSV line, "Contact support" if stuck
- Success — modal closes, toast confirms, dashboard refreshes

---

## S05 — Settings — Investment preferences (`/settings/preferences`)

**Purpose**: Edit every field in the `investment_preferences` database row without SQL.

**Who sees it**: Any user who wants to adjust how `/invest` behaves.

**Content (grouped sections)**:

1. **Contribution planning**
   - Roth IRA annual target ($)
   - Roth IRA YTD contributed ($)
   - Roth 401(k) % of salary
   - Emergency fund target ($)
2. **Cash strategy**
   - Brokerage cash floor ($)
3. **Allocation guardrails**
   - Single-position cap (%) — optional
   - Core allocation min (%) — with tooltip explaining what counts as "core"
   - Core tickers — multi-select of tickers considered core (default: VTI, VOO, QQQ, SCHG)
   - Sector caps — table where each sector can have a max % (optional)
   - Excluded tickers — list input
4. **Behavior toggles**
   - Allow sell recommendations (toggle)
   - Allow tax-loss harvesting (toggle)
   - Rebalance drift threshold (%)
5. **Notes** — free-form textarea for things the user wants the AI to remember

Each field has a tooltip explaining what it does. "Save" button at bottom, optimistic update with rollback on failure.

---

## S06 — Settings — Profile (`/settings/profile`)

**Purpose**: Edit demographic info that underpins financial recommendations.

**Content**:
- Name, age, income, occupation
- Fixed monthly expenses (editable list: name, amount, frequency)
- Payroll details (semi-monthly gross, 401(k) %, direct-deposit split) — optional
- Risk tolerance (conservative / moderate / aggressive)
- Time horizon (short / medium / long)
- Sector bias (tag-style multi-select)

Read-mostly; updates are infrequent.

---

## S07 — Settings — Account (`/settings/account`)

**Purpose**: Auth + integration-wide controls.

**Content**:
- Email, password change (Phase 2)
- Two-factor auth (Phase 3)
- Data export — "Download all my data as JSON"
- Danger zone — delete all data, delete account

---

## S08 — Analysis (`/analysis`)

**Purpose**: Deep-dive on portfolio composition. Where a user goes after the dashboard summary isn't enough.

**Content zones**:

1. **Asset allocation detail** — breakdown beyond just equities/cash/crypto (US equity, international, fixed income, real estate, etc.)
2. **Sector exposure** — horizontal bars, with drilldown per sector (click → shows holdings in that sector)
3. **Holdings table** — every holding across all accounts, sortable/filterable:
   - Columns: symbol, name, account, quantity, avg cost, current price, current value, $ gain/loss, % gain/loss, sector, asset class
   - Row actions: see all trades (Phase 2), exclude from analysis, flag for TLH
4. **Concentration view** — top N positions as % of portfolio, with a single-position-cap line if configured
5. **Cost basis summary** — total cost basis, total unrealized gain/loss
6. **Per-account deep-dive cards** — expand one to see that account's holdings table

**Actions**: Export CSV, filter by account/asset class/sector

---

## S09 — History / Snapshots (`/history`)

**Purpose**: Show how the portfolio has changed over time.

**Content**:
1. **Net worth line chart** — from first snapshot to today, with benchmarks overlaid (optional: S&P 500, portfolio-weighted)
2. **Snapshot table** — one row per snapshot with date, net worth, savings rate, delta vs. prior snapshot
3. **Account-level trends** — multi-line chart, one line per account
4. **Recent significant events** — big moves (>5%), new positions, closed positions

**Actions**: Export, change date range, compare two snapshots side-by-side

---

## S10 — Assistant (`/assistant`) [Phase 2]

**Purpose**: Conversational AI (Gemini) that has tools for reading the user's data and helping with app tasks.

**Layout**:
- Full-page chat UI (left: conversation, right: current-context panel)
- Floating chat widget is an alternative entry; full-page is for deeper sessions

**Content**:
- Conversation history (user + assistant messages)
- Message composer at bottom, with suggestion chips above ("What should I do today?" / "Help me connect Fidelity" / "Explain Roth IRA")
- **Context panel** (right side, toggleable): shows the live data the assistant can see — current portfolio snapshot, preferences, recent syncs. Transparency about what's grounding the response.
- **Tool call indicators** — when the assistant calls a tool (e.g., "Fetching your holdings..."), a subtle inline status appears
- **Per-message disclaimer** — every assistant response ends with a templated footer (see content doc)

**Actions**: New conversation, history, export conversation, feedback thumbs

---

## S11 — Onboarding — Welcome (`/onboarding/welcome`) [Phase 2]

**Purpose**: First impression. Explain what the product is without overwhelming.

**Content**:
- Big headline: "See everything. Decide faster."
- 3 cards summarizing: "Connect accounts" / "Get recommendations" / "Ask the AI"
- CTA: "Get started"
- Small link: "Skip setup, just explore" (leads to dashboard with zero connections)

---

## S12 — Onboarding — Profile (`/onboarding/profile`) [Phase 2]

**Purpose**: Collect the minimum profile needed for recommendations.

**Content**:
- Name, age, approximate income
- Risk tolerance (3 cards: conservative / moderate / aggressive)
- Time horizon (short / medium / long as 3 cards)

Skippable. All can be edited later in Settings.

---

## S13 — Onboarding — Connections wizard (`/onboarding/connect`) [Phase 2]

**Purpose**: Set up first integration with clear win.

**Content**:
- "Pick your primary brokerage" — cards for Schwab, Fidelity, Robinhood
- On click → inline setup for that platform (OAuth button or API-key paste or CSV upload)
- After first connection → "Connect another?" with remaining options, or "I'm done"
- Progress indicator: "Step 2 of 4"

---

## S14 — Onboarding — Preferences (`/onboarding/preferences`) [Phase 2]

**Purpose**: Set the non-default investment preferences that power `/invest`.

**Content**: A simplified version of S05, grouped into 3 short steps:
1. Contribution targets (Roth IRA annual, already contributed)
2. Allocation style (2 sliders: aggressive ↔ conservative, concentrated ↔ diversified)
3. Sector interests (tag-select of biases)

Everything skippable; defaults work.

---

## S15 — Onboarding — Complete (`/onboarding/complete`) [Phase 2]

**Purpose**: Wrap-up; show first real dashboard.

**Content**:
- "You're set up!" with a summary: "N accounts connected, $X total tracked"
- "Your first recommendations are ready" — leads to dashboard
- Offer AI assistant tour ("Want a quick walkthrough of what I can do?")

---

## S16 — Sign in / Sign up (`/auth`) [Phase 2]

**Purpose**: Authentication.

**Content**:
- Sign in with email/password
- Sign in with Google
- Sign up link
- (Phase 3) magic link option

Standard Supabase Auth UI acceptable.

---

## S17 — Empty / zero-state dashboard

**Purpose**: What a brand-new user sees before connecting anything.

**Content**:
- Friendly: "Let's connect your first account"
- Cards for each Tier 1 and Tier 2 integration with "Connect" CTAs
- Small link: "Or try it with sample data" (populates a demo account — Phase 2)

This is a mode of S01, not a separate URL.

---

## S18 — Sync log viewer (`/history/sync-log` or accessible from S02)

**Purpose**: Debug why something didn't sync.

**Content**: Table with columns: timestamp, source, status (success/error), message, metadata (expandable JSON)

Filters: by source, by status, by date range.

Useful for power users and when the AI assistant needs to diagnose (Phase 2: AI can quote from this).

---

## S19 — Error pages — 404, 500

Standard. Friendly tone. Link back to dashboard.
