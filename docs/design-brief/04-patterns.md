# UI Patterns & Component Library

Reusable patterns that appear across screens. The design system should codify these once and apply them everywhere.

---

## 1. Status badge (the most important pattern)

Used on every integration card, every account card, every sync-log row. Communicates state at a glance.

**Variants**:

| State | Color family | Label | Icon | Meaning |
|---|---|---|---|---|
| `connected` | green | "Connected" | ● (solid dot) | Live API, healthy |
| `csv-fresh` | blue | "CSV — current" | ↓ | CSV-based, imported in last 7 days |
| `csv-stale` | amber | "CSV — refresh needed" | ⚠ | CSV-based, last import > 7 days ago |
| `error` | red | "Needs attention" | ⚠ | Something failed — token expired, API error, etc. |
| `not-set-up` | gray | "Not set up" | ○ (outline dot) | No credentials yet |
| `coming-soon` | gray, muted | "Coming soon" | ⏳ | Planned, not yet available |

**Shape**: small pill, always paired with text — never color-only (accessibility).

---

## 2. Metric tile

The hero unit on the dashboard. Big number + contextual delta.

**Anatomy**:
```
┌────────────────────────────┐
│ LABEL (small, uppercase)   │
│                            │
│  $184,899.32               │ ← primary value, bold, large (36-48px)
│                            │
│  ▲ +$2,067 (+1.16%)        │ ← delta row, semantic color
│  today                     │
└────────────────────────────┘
```

**Variants**:
- Primary (dashboard hero) — largest
- Secondary (per-account cards, analysis page) — medium
- Inline (in tables, in copy) — small, matches body text

Delta colors: green for positive, red for negative, gray for zero. Never rely on color alone — always include the arrow/sign.

---

## 3. Account summary card

Condensed view of one account. Appears on S01 (dashboard) in a horizontal row, on S08 (analysis) in a grid.

**Anatomy**:
```
┌──────────────────────────────────────┐
│ [icon] Individual Brokerage          │
│ Schwab · Live                        │
│                                      │
│ $82,380                              │
│ ▲ +$458 (+0.56%) today               │
│                                      │
│ 27 positions · $21,035 uninvested    │
│                                      │
│ [Status badge: Connected]            │
└──────────────────────────────────────┘
```

**Actions**: click-through to account detail (modal or page); sync-now icon-button on hover.

---

## 4. Integration card (on Connections page)

Larger than the account card, setup-focused.

**Anatomy**:
```
┌────────────────────────────────────────────────┐
│ [logo] Charles Schwab           [badge]        │
│                                                │
│ Individual, Roth IRA, Checking, Savings        │
│ 4 accounts                                     │
│                                                │
│ Token valid until 4/29/2026 — reauth every 7d  │
│                                                │
│                           [Sync Now] [Manage]  │
└────────────────────────────────────────────────┘
```

**State-driven styling**:
- `connected` / `csv-fresh` — standard card bg
- `error` — left border in red, or subtle red tint on the whole card
- `coming-soon` — muted background, buttons disabled, non-interactive visual treatment

---

## 5. Action list item (for recommendations)

Used in the `/invest` brief rendering (Phase 2 in-app), and anywhere the AI surfaces actionable recommendations.

**Anatomy**:
```
┌──────────────────────────────────────────────────────┐
│ [priority #]  BUY $5,500 VOO in Schwab Brokerage     │
│                                                      │
│ Biggest single move toward the 50% core target.      │ ← one-sentence rationale
│                                                      │
│ Tags: [core] [brokerage]    [Mark as done]           │
└──────────────────────────────────────────────────────┘
```

**Variants** — action type color tags: `BUY` (green), `SELL` / `TRIM` (amber), `HOLD` (gray), `CONTRIBUTE` (blue, for Roth transfers).

---

## 6. Freshness indicator

Small element showing "how stale is this?". Appears per source on cards; aggregate on top bar.

**Formats**:
- "Last synced 2 min ago" (very fresh, mute color)
- "Last synced 2 hours ago" (fresh, default color)
- "Last imported 9 days ago" (CSV-stale, amber)
- "Last synced 40 days ago — please refresh" (very stale, red)

Relative time only; absolute timestamp shown on hover/tooltip.

---

## 7. Disclaimer banner / footer

Required by every recommendation surface.

**Variants**:
- Inline footer (under action lists, AI responses): small, muted text:
  > *Informational only — not financial, tax, or legal advice.*
- Page-level footer (dashboard, analysis): same text, slightly larger, persistent at bottom of shell
- Modal variant (first-time warning when a user enables certain features): full sentence — "These recommendations are generated based on your stated preferences and current portfolio. They are not personalized financial advice. Consult a licensed advisor before making significant decisions."

---

## 8. AI chat message

Two kinds: user and assistant. Assistant messages can include:
- Plain markdown text
- Inline tables (holdings, flags)
- Inline action chips ("Run sync now", "Open Settings")
- Tool-call status pills ("Reading your portfolio...")
- Disclaimer footer (always, on assistant messages with recommendations)

**Anatomy (assistant)**:
```
┌──────────────────────────────────────────────┐
│ [icon] Assistant · 3:42 PM                   │
│                                              │
│ You have $3,000 of Roth IRA room remaining.  │
│ The standard move is to fill it before year- │
│ end. Into VOO (which you already hold):      │
│                                              │
│ ┌─────────────────────────────────────┐      │
│ │ BUY $3,000 VOO in Schwab Roth IRA   │      │
│ └─────────────────────────────────────┘      │
│                                              │
│ *Informational only — not financial advice.* │
└──────────────────────────────────────────────┘
```

---

## 9. Upload dropzone

Used in S04 and the CSV-tile inline setup in S03.

**States**:
- Idle: dashed border, "Drag a CSV here or click to pick a file"
- Drag-over: solid border, tinted background, "Release to upload"
- Parsing: spinner, "Reading your file..."
- Preview: first 5 rows of parsed data, column headers, "Confirm" / "Cancel"
- Error: red state, shows which row failed, "Try again"

Accessible — always has keyboard fallback (click → native file picker).

---

## 10. Preference field types (for S05)

Different input patterns for different preference fields:

- **Number-with-unit**: input + unit suffix ($, %)
- **Toggle**: yes/no as a switch with label
- **Multi-select chips**: core tickers, sector bias — tags that can be removed
- **Sector-cap table**: 2 columns (sector, max %), add/remove rows
- **Free-form textarea**: notes field

All fields save optimistically; failure toasts with rollback.

---

## 11. Data table (holdings, transactions, sync log)

Sortable, filterable, paginated.

**Features**:
- Sticky header
- Clickable column headers for sort (single-level for now)
- Filter bar above (per-column filters where relevant; global search always)
- Row action dropdown (⋮) for per-row actions
- Export CSV button above
- Empty state row when filtered results are empty
- Row hover tints but doesn't change layout

---

## 12. Allocation chart (donut / stacked bar)

Used on S01 (dashboard) and S08 (analysis). Recharts-backed.

**Requirements**:
- Legend interactive (click to toggle segment)
- Hover shows $ and % both
- "Other" segment absorbs anything < 2% (but clicking it expands to show the detail)
- Colorblind-safe palette (not red/green alone to distinguish sectors)

---

## 13. Line chart (net worth, account trends)

Used on S09.

**Requirements**:
- Brush below for range selection
- Tooltips show date + value
- Reference line for a baseline (first snapshot value)
- Benchmark overlay toggle (S&P 500) — dashed line

---

## 14. Empty states (every list/chart)

Every table, chart, and list needs a deliberate empty state — not just "no data."

**Pattern**:
```
┌──────────────────────────────────────┐
│   [icon]                             │
│                                      │
│   No sync history yet                │
│                                      │
│   Once you connect and sync an       │
│   account, you'll see the log here.  │
│                                      │
│   [Go to Connections]                │
└──────────────────────────────────────┘
```

Always includes: icon, one-line description, context (why this is empty), CTA (what to do next).

---

## 15. Loading states

- **Skeleton shimmer** for zones above the fold
- **Spinner** only for small inline actions (< 2 sec expected)
- **Progress bar** for known-duration operations (CSV upload, sync)
- **Never** a blank screen for more than ~200ms

---

## 16. Error states

- **Toast** for transient errors (sync failure, save failure, etc.) — auto-dismiss after 6s, manual dismiss supported
- **Inline** for form validation (below the field, red text + icon)
- **Banner** for page-level issues (1+ errored connection, stale data warning)
- **Page error** (S19) for unrecoverable — 500, 404, network loss

Tone: calm, specific, actionable. Never blame the user. Always suggest the next step.

---

## 17. Notification toast

Appears bottom-right (or bottom-center on mobile).

**Variants**:
- Success (green border)
- Info (blue border)
- Warning (amber border)
- Error (red border)

One at a time; new toast replaces prior within 500ms.

---

## 18. Confirmation modal

For destructive actions: "Delete this integration?", "Delete all my data?", "Reset preferences?"

**Anatomy**: title, body (what will happen + consequences), cancel + destructive buttons (destructive = red fill, right-aligned).

---

## 19. Responsive expectations

- **Desktop-first** (this is a data-heavy app; users are likely on laptops)
- **Tablet**: everything usable; two-column layouts collapse to one
- **Mobile**: dashboard hero + account cards work; connections page works; chat works; tables become cards; analysis page might defer to a "view on desktop" hint
- Nav collapses to a bottom tab bar on mobile

---

## 20. Accessibility

- All interactive elements keyboard-reachable
- Focus states visible, not subtle
- Color never the only signal (badge state also has icon + text)
- Minimum contrast 4.5:1 for body, 3:1 for large text
- Screen reader: proper headings, labels on inputs, alt text, aria-live for async updates
