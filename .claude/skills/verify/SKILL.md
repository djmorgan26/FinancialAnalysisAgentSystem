---
name: verify
description: End-to-end verification of this app's features. Use whenever the user says "verify", "check that X works", or wants proof a change actually works — covers API-only smoke tests (fast) and UI/browser checks (visual, via Playwright). Handles auth as the dedicated TEST_USER, never the owner.
---

# verify

This app is multi-user, auth-gated, and has two production-grade verification layers already wired up. Use them instead of reinventing.

## Which layer to use

```
User wants to verify something →
  ├─ Is it a JSON API / route handler? → HTTP layer (fast, no browser)
  │    scripts/verify-*.ts pattern (supabase-js → cookie → fetch)
  │
  └─ Is it UI/visual/render correctness? → Browser layer (Playwright)
        templates/ui-verify.py — sign in, navigate, screenshot
```

Default to the HTTP layer when possible — it's ~3s vs ~45s.

## Hard rules

- **Never reset the owner's password** (`davidjmorgan26@gmail.com`). Always use `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` from `.env.local`. If sign-in fails, run `npx tsx scripts/ensure-test-user.ts` to reseed.
- **Default target is local** (`http://localhost:3000`). Only hit production (`https://financial-analysis-agent-one.vercel.app`) when the user explicitly says "prod" or "deployed".
- **Don't commit verification scripts to the repo.** Write ad-hoc scripts to `/tmp/`. Persistent verifiers belong in `scripts/verify-*.ts`.

## HTTP layer — fast smoke tests

Existing scripts (run as-is, they already handle TEST_USER auth + cookie forwarding):

```bash
npx tsx scripts/verify-dashboard.ts [BASE_URL]   # GET / → 200, dashboard HTML
npx tsx scripts/verify-assistant.ts  [BASE_URL]   # POST /api/assistant → text response
```

`BASE_URL` defaults to production. Pass `http://localhost:3000` for local.

**To verify a NEW route**, clone the shape of `scripts/verify-assistant.ts`:
1. `loadEnv()` from `.env.local`
2. `createServerClient` + `signInWithPassword({ email, password })`, capture cookies
3. `fetch(url, { headers: { cookie: cookieHeader } })`
4. Assert status + a key field in the body.

Save it as `/tmp/verify-<feature>.ts` and run with `npx tsx`. Promote to `scripts/verify-<feature>.ts` only if the user asks for a permanent fixture.

## Browser layer — visual / UI verification

Use when the question is "does this render correctly?" (styling, markdown, charts, modals).

### The two gotchas that will bite you

1. **Python interpreter**: Playwright lives on `/opt/homebrew/bin/python3.13`. The PATH `python3` under subprocess usually isn't it. Always invoke scripts as `/opt/homebrew/bin/python3.13 /tmp/foo.py`.
2. **Dev server**: If nothing responds on `:3000`, don't poll — the old `next-server` process may be wedged. `lsof -ti:3000 | xargs -r kill -9`, then use the `with_server.py` helper from the `webapp-testing` skill:
   ```bash
   python3 ~/.claude/skills/webapp-testing/scripts/with_server.py \
     --server "npm run dev" --port 3000 --timeout 120 \
     -- /opt/homebrew/bin/python3.13 /tmp/verify-ui.py
   ```
   It starts the server, waits for readiness, runs your script, tears down.

### Template

Copy `templates/ui-verify.py` (next to this SKILL.md) to `/tmp/verify-ui.py`, customize the `navigate_and_assert()` body, and run it via `with_server.py`. The template handles: `.env.local` loading, TEST_USER login, navigation, screenshot to `/tmp/`.

### Viewing the screenshot

After the script runs, Read `/tmp/verify-ui.png` (or whatever path you used) — you can see the image directly and describe what rendered. That's the "verify" step. Do not claim success without looking at the screenshot; a 200 response is not proof of visual correctness.

## The verification loop (do not stop on first failure)

Per the user's global instructions: iterate automatically.

1. Run the check.
2. If it fails, read the error / screenshot, fix the code, retry.
3. Repeat until green. Report the final state, not intermediate failures.

Do not ask "should I keep trying?" — keep trying.

## After local verification passes

If the user asked for deploy, verification on local doesn't substitute for prod. After pushing, re-run the same checks against the prod URL:

```bash
npx tsx scripts/verify-assistant.ts   # defaults to prod
```
