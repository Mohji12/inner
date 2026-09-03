import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
creds = json.loads((ROOT / ".e2e-coach-credentials.json").read_text(encoding="utf-8"))
login_url = creds["frontend_login"]
email = creds["email"]
password = creds["password"]
name = creds["full_name"]

print("Opening", login_url)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, slow_mo=150)
    page = browser.new_page()

    def log_response(resp):
        if "/auth/" in resp.url:
            print(f"  NET {resp.status} {resp.request.method} {resp.url}")

    page.on("response", log_response)
    page.goto(login_url, wait_until="networkidle", timeout=60_000)
    page.wait_for_timeout(1000)

    # Role grid: User / Coach / Admin — click middle (coach) by structure
    role_btns = page.locator("form button, .grid button, button").filter(has_text="Coach")
    if role_btns.count() == 0:
        role_btns = page.locator("button").filter(has_text="Mentor")
    if role_btns.count():
        role_btns.first.click()
    else:
        # Fallback: third button in role row often Admin; second is Coach
        candidates = page.locator("button.rounded-md.border")
        if candidates.count() >= 2:
            candidates.nth(1).click()
            print("  clicked role button index 1")

    page.locator("input[type='email']").first.fill(email)
    page.locator("input[type='password']").first.fill(password)
    page.locator("button[type='submit']").first.click()
    page.wait_for_timeout(3000)
    print("URL after submit:", page.url)
    err = page.locator(".text-destructive, [role='alert']").all_text_contents()
    if err:
        print("UI errors:", err)

    try:
        page.wait_for_url("**/mentor/**", timeout=30_000)
        print("LOGIN OK ->", page.url)
    except Exception as e:
        print("LOGIN navigation failed:", e)
        print("page text sample:", page.inner_text("body")[:800])
        page.screenshot(path=str(ROOT / "e2e-login-fail.png"))
        browser.close()
        raise

    page.goto("http://127.0.0.1:8081/mentors", wait_until="networkidle", timeout=60_000)
    page.wait_for_timeout(4000)
    print("CARD VISIBLE" if name in page.content() else f"CARD NOT IN HTML for {name!r}")
    page.wait_for_timeout(8000)
    browser.close()
print("done")
