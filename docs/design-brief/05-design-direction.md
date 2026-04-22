# Design Direction

Visual style guidance. Directional, not prescriptive — the design system is still open. These are the non-negotiables and the aesthetic targets.

---

## Aesthetic target

**Dense but breathable. Calm, not loud. Trustworthy like a bank statement, useful like a terminal, pleasant like a good native app.**

**References in spirit** (not literal copying):
- Linear (Linear.app) — dense but never cluttered, beautiful type, dark mode that respects your eyes
- Stripe dashboard — financial data presented with confidence
- Plaid product pages — clear explanation of state, honest about limitations
- A good terminal UI like Fish or Warp — mono typography for numbers, room for information

**What we are NOT going for**:
- Robinhood's gamified green confetti
- Mint's cluttered widget shelves
- Crypto-bro neon
- Any "fintech bro" aesthetic with gradients and icons of rockets
- Anything that feels like it wants you to trade more often

---

## Dark mode first, light mode second

**Current app is dark.** Power users overwhelmingly prefer dark. Design dark-first, but every wireframe should have a light variant sketched or at minimum tokens defined so light mode isn't an afterthought.

Transitions between modes respect user preference (OS, then in-app override).

---

## Color direction (tokens open, semantic clear)

Don't pick final hex values here — leave the exact palette to the design system work. But the **semantic roles** are fixed:

| Role | Use | Dark mode direction | Light mode direction |
|---|---|---|---|
| `bg-surface` | Primary background | Near-black, slight warmth (not pure #000) | Near-white, warm tint |
| `bg-elevated` | Cards, modals | One step lighter than surface | One step darker than surface |
| `border` | Subtle dividers | Low-contrast gray | Low-contrast gray |
| `text-primary` | Body, headings | Near-white | Near-black |
| `text-secondary` | Labels, timestamps | Muted gray | Muted gray |
| `accent` | Primary actions, links | Single brand color (TBD — consider blue or teal) | Same, adjusted for contrast |
| `gain` | Positive deltas | Green (ADA-compliant, not neon) | Same |
| `loss` | Negative deltas | Red (ADA-compliant, not alarming-red) | Same |
| `neutral` | Zero change, stable | Mid-gray | Mid-gray |
| `warning` | Stale data, needs attention | Amber | Amber |
| `error` | Failed sync, critical | Red | Red |

**Critical rule**: never use color alone to distinguish state. Every status always pairs color with icon + text.

---

## Typography

**Two typefaces, clear roles**:

1. **Sans-serif for prose** — headings, body, labels
   - Candidates: Inter, Geist Sans, or system-ui fallback
   - Weight range: 400-700

2. **Monospace for numbers** — balances, quantities, tickers, timestamps, any tabular data
   - Candidates: JetBrains Mono, Geist Mono, or ui-monospace fallback
   - Weight: 400, 500 for emphasis

**Why mono for numbers**: tabular alignment. When you have rows of $1,234.56 / $12.34 / $123,456.78, monospace keeps them readable. Numbers-are-data, not prose.

**Scale** (direction, final sizes TBD):
- Display (hero net worth): ~48px / 1.1 line-height
- H1: ~28px
- H2: ~20px
- Body: ~14-16px
- Small / labels / timestamps: ~12-13px

---

## Spacing & layout

**Grid**: 8px base unit. Use 8, 16, 24, 32, 48 — not odd numbers.

**Content width**: cap at ~1400px on large monitors; don't stretch tables across 4K displays.

**Card vs. page edge padding**: cards have 24px internal padding; pages have 32px inset from shell.

**Density** — default to "comfortable" (a bit more breathing room than "compact"), with a power-user toggle in Settings to switch to compact (denser tables, smaller card padding). Phase 2.

---

## Iconography

- **Single-style icon set** — pick one (Lucide or Phosphor or Heroicons). Don't mix.
- **1.5-2px stroke**, not chunky
- **Semantic, not decorative** — every icon communicates something specific
- Size: 16px (inline), 20px (buttons), 24px (card headers), 32px+ (empty states)

---

## Motion

- **Subtle, not showy**. Fades and slides, never bounces.
- **Durations**: 150ms for micro-interactions, 250ms for modal enter/exit, 400ms for page transitions.
- **Respect `prefers-reduced-motion`** — reduce or disable animations.
- **Skeleton shimmer** — the one exception; subtle animation is OK because it indicates loading.

---

## Charts

**Recharts** is the current lib. Keep it.

**Style**:
- Minimal axes — remove chart junk
- Colors for segments: distinct but not neon — aim for palette that works colorblind (avoid red/green adjacency)
- Gridlines: very subtle, almost invisible
- Tooltips: card-style with same tokens as the rest of the UI, not native
- Always annotate axes and legends — no unlabeled charts

---

## Photography / illustrations

**None**, except:
- Tiny platform logos (Schwab, Coinbase, etc.) for visual recognition on cards
- One or two simple empty-state illustrations (can be abstract line art)

Avoid stock photography and cartoon illustrations entirely.

---

## Disclaimers & legal text

Not an aesthetic but a placement rule:
- Always visible, never dismissible, but also never dominant
- Smaller than body, usually italic or a distinct weight
- At the bottom of every recommendation surface
- Templated text (not AI-generated) — see `06-content-and-copy.md`

---

## Non-negotiables

These are non-negotiable even if the rest of the design changes:

1. **Dark mode works.** It's the primary mode for the primary user.
2. **Numbers are monospace.** Non-negotiable for tabular data.
3. **Status is never color-alone.** Icons + text + color, always.
4. **The dashboard is fast to scan.** Hero metric + next-action + account summary all above the fold on a 13" laptop.
5. **Connections page tells the truth.** Four honest states, no hiding behind "sync in progress" forever.
6. **Legal disclaimers are visible** on every recommendation surface.
7. **No bright gamification.** We never dopamine-hook the user. No confetti when they make money. No red flashes when they lose it. Calm.

---

## Interaction posture

- **Keyboard-friendly for power users** — cmd+K palette (Phase 2) for quick navigation, shortcuts visible in tooltips
- **Optimistic updates** — saves happen immediately, with rollback on failure
- **Undo where reasonable** — toast with "Undo" for destructive actions within ~6 seconds
- **Low-friction exploration** — no "Are you sure?" dialogs for things that are trivially reversible

---

## Brand feel (a few adjectives)

Trustworthy. Precise. Understated. A little nerdy. Never paternalistic. Always honest.

If the user asks "what do you actually know?" the app's answer should be visible before they even ask.
