# User Flows

Every journey through the app, with trigger, steps, success path, failure paths, and exit condition. Screens are referenced by ID (S01, S02, etc.) from `02-screens.md`.

---

## F01 — First-run onboarding (Phase 2, new user)

**Trigger**: User arrives at app for the first time, no account exists.

**Steps**:
1. Land on S11 (Welcome)
2. Click "Get started" → S16 (Sign up tab)
3. Create account → email verification → back to S12 (Profile)
4. Fill in profile basics → S13 (Connections wizard)
5. Pick primary brokerage → inline setup within S13
   - If Schwab: OAuth redirect → Schwab authorization → callback → back to S13
   - If Fidelity/Robinhood: S04 (CSV upload modal) inline
   - If Coinbase: API-key paste form inline
6. First connection success → "Connect another?" prompt
   - Yes → back to S13 to add more
   - No → S14 (Preferences)
7. Set preferences (or skip) → S15 (Complete)
8. Click "See dashboard" → S01, first analysis runs automatically

**Failure paths**:
- OAuth fails → stay on S13, inline error, retry option
- CSV parse error → S04 shows the bad row, user can cancel and re-export
- User skips everything → land on S17 (zero-state dashboard)

**Exit condition**: User has an authenticated session and at least one functional data source (or explicitly skipped).

---

## F02 — Daily check-in (the core repeat use)

**Trigger**: Owner opens the app on any given day.

**Steps**:
1. Land on S01 (Dashboard)
2. Scan hero metric row: today's $ change, weekly change
3. Read the "Next action" card → decide to dig in or dismiss
4. Click "See today's brief"
   - **Power user (has Claude Code)**: runs `/invest` locally, brief appears in terminal/Claude interface — outside the web app's flow
   - **Phase 2 in-app**: opens S10 (Assistant) with the `/invest`-equivalent message pre-loaded; assistant streams the brief into chat
5. Review recommendations, optionally execute trades in broker
6. Return to dashboard to see if anything feels off → optionally click "Sync all"

**Failure paths**:
- Sync errors visible → banner links to S02 (Connections) to fix
- Data is stale → banner offers "Sync all"

**Exit condition**: User has either acted on a recommendation or decided no action is needed today.

---

## F03 — Add a new integration (existing user)

**Trigger**: User clicks "Connections" in nav; sees a "Not set up" card for a platform.

**Steps**:
1. S02 (Connections) loads, user scrolls to the "Available to set up" section
2. Click "Set up" on a card → S03 (Connection detail)
3. Follow platform-specific setup:
   - OAuth platforms (Schwab): click "Connect with X" → external redirect → authorize → back to S03
   - API-key platforms (Coinbase, Finnhub): paste key(s) → click "Test connection" → see green or red
   - CSV platforms: read export instructions → open S04 inline
4. Success → sync runs automatically → green status on the card
5. Return to S02 or S01 to see new data

**Failure paths**:
- OAuth denied / callback fails → red state on S03, error message with retry
- API key invalid → S03 inline validation message ("Key test failed: invalid credentials")
- CSV malformed → S04 shows the bad row, user edits and re-uploads OR clicks "Help me" → opens assistant (Phase 2)

**Exit condition**: Integration is either `Connected` or user explicitly bailed.

---

## F04 — CSV re-import (Fidelity / Robinhood periodic refresh)

**Trigger**: User notices "Last imported 9 days ago" badge on a CSV-tier card, or reads a "stale data" banner on S01.

**Steps**:
1. Land on S02 from dashboard
2. Click "Upload CSV" on the stale card → S04 (upload modal)
3. Drag or pick a freshly-exported CSV
4. Preview parses → diff appears ("+3 new positions, -2 removed, $412 balance change")
5. Click "Confirm" → sync runs
6. Modal closes, toast: "Fidelity: 11 positions synced, balance updated to $12,703"
7. S01 dashboard data refreshes in place

**Failure paths**:
- Wrong CSV format → parse error in S04 with link to "How to export from Fidelity"
- No change detected → toast "Nothing to update" (not an error)

**Exit condition**: Platform's `last_updated` is now today.

---

## F05 — Ask the AI assistant (Phase 2)

**Trigger**: User clicks floating chat icon, or navigates to S10.

**Steps**:
1. S10 (or chat sheet) opens
2. User types a question — examples:
   - "What's a Roth IRA?" → educational answer
   - "Why is SMH on my watchlist?" → reads preferences + recent brief, explains
   - "Help me connect Fidelity" → step-by-step walkthrough with inline links
   - "Should I sell NVDA?" → reads portfolio, suggests framework + shows disclaimer
3. Assistant may call tools:
   - `getPortfolioSummary()` — shown in UI as "Reading your portfolio..."
   - `getHoldings()` — inline table in response
   - `getSyncStatus()` — to diagnose connection issues
4. Response streams with thinking indicators
5. Response ends with templated disclaimer footer

**Failure paths**:
- Gemini API rate limit → "I'm at my limit for the moment — try again in 60 seconds"
- Tool call failure → assistant acknowledges and offers to help diagnose
- Assistant unsure → it says so explicitly ("I don't have that data — try running Sync first")

**Exit condition**: User closes chat or question answered.

---

## F06 — Handle a sync error (Schwab token expired, most common)

**Trigger**: User opens dashboard and sees top-banner "1 source needs attention" OR receives a sync failure via email (Phase 2) OR notices stale data.

**Steps**:
1. Click banner → S02 (Connections) with the errored card highlighted
2. Red state on Schwab card: "Token expired — reauthenticate"
3. Click "Reauthenticate" → OAuth redirect → user re-consents
4. Callback → S02 with Schwab card now green
5. Automatic sync runs → toast "Synced 2 accounts, 39 positions"

**Failure paths**:
- User doesn't re-auth → data keeps getting staler; banner persists
- Re-auth also fails → error detail in sync log S18; user can open ticket / ask assistant

**Exit condition**: Schwab back to green OR user explicitly disconnects.

---

## F07 — Update investment preferences

**Trigger**: User realizes they want to change something (e.g., contributed more to Roth, changed risk tolerance, added a ticker to excluded list).

**Steps**:
1. Nav → Settings → Preferences (S05)
2. Edit one or more fields
3. "Save" button → optimistic update, toast confirms
4. Next `/invest` or AI chat uses the new values

**Failure paths**:
- Validation error (e.g., percentage > 100) → inline error, save disabled
- Save failure → error toast, revert optimistic update

**Exit condition**: Preferences saved.

---

## F08 — View historical snapshot / compare two points in time

**Trigger**: User wants to see how they've done over time.

**Steps**:
1. Nav → History (S09)
2. Default view: net-worth line chart from first snapshot to today
3. User selects a date range → chart updates
4. Click any two points on the chart → side-by-side comparison view:
   - Net worth delta, account-level deltas, positions added/removed
5. Export comparison as CSV or share link (Phase 3)

**Failure paths**:
- No snapshots yet → empty state with CTA "Run your first analysis"

**Exit condition**: User has seen what they wanted.

---

## F09 — Empty/zero state onboarding (user who skipped setup in F01)

**Trigger**: User signed in but has no connections.

**Steps**:
1. S01 (dashboard) loads in S17 (zero-state) mode
2. User sees "Connect your first account" cards for each platform
3. Click any card → behaves like F03 from step 2 onward
4. After first successful sync → S01 re-renders in normal mode with new data

**Exit condition**: ≥1 connection active.

---

## F10 — Cross-flow: "AI-assisted connection help" (Phase 2)

**Trigger**: Any connection fails in F03 or F06 and the user clicks "Help me with this".

**Steps**:
1. In-app chat opens (sheet, not full page) with context pre-loaded:
   - "I'm trying to connect Fidelity but got this error: [error message]"
2. Assistant reads the sync log (S18 data) and recent attempts
3. Assistant suggests specific steps:
   - For Fidelity: "The CSV you uploaded has only headers — try re-exporting from Fidelity → Accounts → Portfolio → Download"
   - For Schwab: "Your refresh token expired 2 days ago. You'll need to reauthenticate — click here"
4. Inline CTA buttons inside the chat ("Open Schwab reauth", "Try uploading again")
5. User acts, success or escalation

**Exit condition**: Issue resolved or user gives up.

---

## F11 — Transparent limitations encounter

**Trigger**: User expects a feature that isn't available (e.g., clicks on a Chase "Coming soon" card).

**Steps**:
1. S02 shows Chase card with "Coming soon" state (non-interactive style — see patterns)
2. User clicks the card anyway
3. Subtle modal: "Bank integration is planned for a future release. We're evaluating Plaid for this — currently the best bet is to connect Chase read-only via a CSV export (if Chase provides one)."
4. Optional: "Notify me when this is available" email capture

**Exit condition**: User understands the state and moves on.

---

## Flow diagram (at a glance)

```
[Landing] → [Sign up] → F01 Onboarding → [Dashboard S01]
                                                │
       ┌───────────────────────┬────────────────┼─────────────────┬────────────────────┐
       ▼                       ▼                ▼                 ▼                    ▼
   F02 Daily            F03 Add integration  F07 Update prefs  F05 Ask AI           F08 History
   check-in             (S02 → S03 → sync)   (S05)             (S10 or widget)      (S09)
       │                       │                                       │
       ▼                       ▼                                       │
   /invest brief         [S02 → S03 → S04]                              │
   or AI chat                  │                                        │
                               ▼                                        │
                          F06 Handle error ────── F10 AI-assisted ──────┘
                          (re-auth / re-import)    connection help
```

Any flow can route to F10 when something goes wrong.
