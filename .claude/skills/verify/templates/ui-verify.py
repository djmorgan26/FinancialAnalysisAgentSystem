"""
UI verification template — signs in as TEST_USER, navigates to a path,
runs any per-feature interaction, and screenshots the result.

Copy to /tmp/verify-<feature>.py, edit navigate_and_assert(), then:

  python3 ~/.claude/skills/webapp-testing/scripts/with_server.py \
    --server "npm run dev" --port 3000 --timeout 120 \
    -- /opt/homebrew/bin/python3.13 /tmp/verify-<feature>.py

Use /opt/homebrew/bin/python3.13 — that is where the `playwright` module lives.
Plain `python3` under subprocess usually resolves to a different interpreter
that does NOT have playwright installed.
"""
import os
import sys
from playwright.sync_api import sync_playwright, Page


# ---------- config (edit per-feature) ----------
BASE = os.environ.get("VERIFY_BASE", "http://localhost:3000")
TARGET_PATH = "/assistant"                       # page you're verifying
SCREENSHOT = "/tmp/verify-ui.png"                # where to drop the artifact
# -----------------------------------------------


def read_dotenv(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return out


def sign_in(page: Page, email: str, password: str) -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    # Supabase SSR cookies land + redirect; give it a beat.
    page.wait_for_timeout(1500)


def navigate_and_assert(page: Page) -> str:
    """
    Per-feature logic. Edit this. Return a short summary string — whatever
    signal you want to print so the caller can read it without opening the
    screenshot.
    """
    page.goto(f"{BASE}{TARGET_PATH}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    # --- EXAMPLE: send a prompt to the assistant and wait for markdown ---
    # page.fill('input[placeholder*="Ask anything"]', "What should I do today?")
    # page.click('button[type="submit"]')
    # page.wait_for_selector(".assistant-markdown", timeout=45000)
    # page.wait_for_timeout(6000)

    # Return anything useful — a title, a count, first 200 chars of text, etc.
    title = page.title()
    return f"title={title!r}"


def main() -> int:
    env = read_dotenv(".env.local")
    email = env.get("TEST_USER_EMAIL") or os.environ.get("TEST_USER_EMAIL")
    password = env.get("TEST_USER_PASSWORD") or os.environ.get("TEST_USER_PASSWORD")
    if not email or not password:
        print(
            "Missing TEST_USER_EMAIL / TEST_USER_PASSWORD. "
            "Run: npx tsx scripts/ensure-test-user.ts",
            file=sys.stderr,
        )
        return 1

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        page = ctx.new_page()
        try:
            sign_in(page, email, password)
            summary = navigate_and_assert(page)
            page.screenshot(path=SCREENSHOT, full_page=True)
            print(f"OK  {summary}  screenshot={SCREENSHOT}")
            return 0
        except Exception as e:
            try:
                page.screenshot(path=SCREENSHOT, full_page=True)
            except Exception:
                pass
            print(f"FAIL {type(e).__name__}: {e}  screenshot={SCREENSHOT}", file=sys.stderr)
            return 1
        finally:
            browser.close()


if __name__ == "__main__":
    sys.exit(main())
