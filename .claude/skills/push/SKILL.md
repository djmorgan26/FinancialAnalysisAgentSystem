---
name: push
description: Scan, commit, and push changes to main. Runs a secrets scan, verifies docs structure, auto-generates a concise standardized commit message, stages, commits, and pushes to origin/main. Use when the user says "push", "ship it", "push to main", or /push.
---

# push

One command, four gates, push. If any gate fails, stop and tell the user — never force past.

## The gates (run in order)

### Gate 1 — Working tree sanity

```bash
git status --porcelain
git diff --stat
```

- If nothing is staged/changed: stop, say "nothing to push".
- If files look unexpectedly huge (lockfile churn, `.next/`, `node_modules/` somehow staged): stop and confirm with the user before proceeding.

### Gate 2 — Secret scan

Run this against files that are **staged or unstaged but tracked**. Do NOT scan `node_modules`, `.next`, `.git`, `dist`, `build`.

```bash
git diff HEAD --name-only | xargs -I {} grep -HnE \
  'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{30,}|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@' \
  {} 2>/dev/null
```

Also check for accidentally-tracked env files:

```bash
git diff HEAD --name-only | grep -E '^\.env($|\.)' | grep -vE '\.env\.example$'
```

Any match → stop. Tell the user exactly which file and line matched. Never commit through it automatically.

False-positive escape hatch: if the user confirms a match is a placeholder/example, proceed.

### Gate 3 — Docs structure

Enforce the standard layout:

```
README.md                 # root, user-facing
CLAUDE.md                 # root, agent instructions
AGENTS.md                 # root, Next.js agent guardrails
docs/ARCHITECTURE.md      # single source, no _v2 suffix
docs/PRD.md               # single source, no _v2 suffix
docs/ROADMAP.md
docs/DATA_SOURCES.md
docs/SCHWAB_SETUP.md
```

Check:

```bash
# 1. No versioned doc stragglers.
ls docs/*_v[0-9]*.md 2>/dev/null

# 2. No stray top-level .md files other than the three above.
ls -1 *.md 2>/dev/null | grep -vE '^(README|CLAUDE|AGENTS)\.md$'

# 3. If `docs/design-brief/` still exists, flag it — that package was one-shot and should be removed after the design landed.
[ -d docs/design-brief ] && echo "WARN: docs/design-brief/ still present"
```

Any hit → stop, report to the user, do not push. The user may say "push anyway" — respect that, but only after reporting.

### Gate 4 — Commit & push

If all gates pass, **do not ask for confirmation** — the user ran /push to push.

1. **Stage**: list specific files by name. Never `git add .` or `git add -A`.
2. **Commit message**: one line, lowercase, imperative, ≤70 chars. No emoji, no type prefixes (`feat:`, `fix:`), no "WIP". Describe the change, not the reason. Examples that match this repo's style (check `git log --oneline -5`):
   - `render markdown in assistant chat`
   - `fix dashboard 500: replace partial unique indexes + catch recompute errors`
   - `shell top-bar net worth: use live account sum, not cached analysis`
3. **Body**: include only when the diff won't explain the change on its own. 2–4 lines max. No bullet lists of bullet lists. No test-plan sections.
4. **Sign-off**: always end with the Co-Authored-By trailer (current model id).
5. **Push**: `git push origin main`.

Use a HEREDOC for the message:

```bash
git commit -m "$(cat <<'EOF'
<one-line subject>

<optional short body>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

## After push

Report one line: commit SHA + pushed branch. If Vercel deploys on push, mention that a production deploy is now running — the user may want to `vercel:status` or run the verify skill against prod in a minute.

## Do not

- Don't bypass hooks (`--no-verify`, `--no-gpg-sign`).
- Don't amend existing commits — create new ones.
- Don't push force. The user must type it.
- Don't push to a branch other than `main` unless the user names one.
- Don't include the full diff or a phase-by-phase narration in the commit body. The diff speaks for itself.
