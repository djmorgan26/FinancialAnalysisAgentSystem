# Design Brief — Financial Dashboard v2.0

This folder is a self-contained package for generating wireframes for the v2.0 redesign. It is the single source of context for the design pass — you shouldn't need the rest of the repo.

## Product in one line

A personal finance dashboard that aggregates every brokerage/bank/crypto account a user has, surfaces specific investment recommendations with dollar amounts and target accounts, and includes an AI assistant that can explain anything and help with connections.

## What to produce

Wireframes (low-to-medium fidelity) for every screen in `02-screens.md`, following the flows in `03-flows.md`, using the patterns in `04-patterns.md`, with the visual direction in `05-design-direction.md` and the content style of `06-content-and-copy.md`.

## Files in this package

| # | File | Purpose |
|---|---|---|
| 00 | `00-README.md` | This file |
| 01 | `01-product-overview.md` | Distilled context: vision, users, what's in vs out |
| 02 | `02-screens.md` | Every screen — purpose, content, actions, states |
| 03 | `03-flows.md` | User journeys connecting screens |
| 04 | `04-patterns.md` | Reusable UI patterns (cards, badges, tiles, modals) |
| 05 | `05-design-direction.md` | Visual tokens, typography, aesthetic, non-negotiables |
| 06 | `06-content-and-copy.md` | Real sample data, copy tone, legal disclaimer templates |

## What the wireframes must get right

1. **Honesty about data status.** Every integration shows one of four states: `Connected`, `CSV — refresh needed`, `Not set up`, `Coming soon`. Users must never wonder "is this working?"
2. **Specific, executable recommendations.** The AI output isn't "consider adding tech" — it's "Buy $5,500 VOO in Schwab brokerage." Wireframes must make room for dollar-amount + ticker + account specificity.
3. **Dual audience.** Power users want data density; newcomers want guidance. Design for both without designing two separate apps.
4. **Legal clarity without friction.** The "informational, not advice" disclaimer appears on every recommendation surface but doesn't dominate the UI.
5. **Connection onboarding that doesn't feel like setup hell.** Users with 0 connections should get to an *actual dashboard* quickly; each new integration should be a clear win.

## What to deliberately skip

- Color palettes beyond the direction in `05-design-direction.md` (the design system decision is still open)
- Mobile-specific layouts (we'll iterate on mobile after desktop is validated — but keep responsive in mind)
- Settings pages beyond what's listed in `02-screens.md`
- Admin / multi-user views (Phase 2+, out of scope here)

## Anchor for scope

This is a Phase 1 + Phase 2 design pass. Phase 1 is "David uses it daily solo." Phase 2 is "a friend can onboard themselves." Phase 3+ (public signup, Plaid, mobile) is out of scope here.
