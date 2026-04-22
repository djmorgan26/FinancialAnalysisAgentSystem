---
name: dev
description: Run the app locally. Kills anything wedged on port 3000, starts `npm run dev` in the background, waits for a real HTTP health check, and reports the ready URL. Use whenever the user asks to "run the app", "start the dev server", "boot it locally", or says /dev.
---

# dev

The Next.js dev server on this repo occasionally wedges — the process lives on `:3000` but stops answering requests. Curling in a polling loop won't fix it. The skill is: inspect, kill, restart, health-check.

## Steps

### 1. Inspect port 3000

```bash
lsof -ti:3000
```

- No output → nothing running, skip to step 3.
- One or more PIDs → step 2.

### 2. Kill whatever's there

Never ask the user to confirm killing a wedged local dev server — that's the point of this skill.

```bash
lsof -ti:3000 | xargs -r kill -9
sleep 1
lsof -ti:3000 || echo "port free"
```

If the port is still held after SIGKILL, something is very wrong (e.g., another user's process). In that case stop and tell the user; don't try to sudo.

### 3. Start the dev server in the background

**Always use `run_in_background: true`**. Do not run `npm run dev` in the foreground — it will block the conversation until timeout.

```bash
npm run dev
# run_in_background: true — capture the bash id
```

### 4. Wait for readiness with a real HTTP check

Don't just sleep and hope. Poll until `/` returns a real HTTP status (200 or 307 redirect to `/login`; both mean Next.js is actually serving). The first compile takes 10–40s.

```bash
until curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://localhost:3000/ | grep -qE "^(200|307)$"; do sleep 2; done && echo READY
```

If after ~60s you still see `000` (connection refused/timeout), something failed during compile. Read the background bash output (`BashOutput`) — look for `Failed to compile`, TypeScript errors, missing env vars, or port-in-use.

### 5. Report

Once ready, tell the user one line:

> Dev server ready at http://localhost:3000 (bash id `xxx`). Login redirect working.

Note the bash id — the user or a follow-up turn may need to stop the server (`KillShell`) later.

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `curl` returns `000` forever | Server still compiling, or crashed silently | `BashOutput` on the dev bash — if it says "Ready", try again; if it has a stack trace, fix the code |
| `EADDRINUSE: address already in use :::3000` | Old process didn't die | Repeat step 2; SIGKILL is mandatory, not optional |
| 500 on `/` immediately | Missing env var (usually Supabase) | `cat .env.example` vs `.env.local`, tell the user which key is missing — do not write env values yourself |
| `Module not found` | `node_modules` out of sync after a dep change | `npm install`, restart |

## Do not

- Don't proactively start the dev server just because you edited a file. Only when the user asks.
- Don't kill a server running on a port other than 3000 unless the user explicitly says so.
- Don't run `npm run dev` in the foreground.
- Don't claim "server is running" based on `lsof` alone — a wedged process shows up in `lsof`. The 200/307 HTTP response is the real signal.
