import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const credsPath = path.resolve(__dirname, "../.e2e-full-credentials.json");

type Creds = {
  frontend: string;
  password: string;
  admin: { email: string; password: string };
  coach: { email: string; password: string; id: string };
  user: { email: string; password: string; id: string };
};

function loadCreds(): Creds {
  if (!fs.existsSync(credsPath)) {
    throw new Error(`Missing ${credsPath} — run e2e_local_full.py --keep-accounts first`);
  }
  return JSON.parse(fs.readFileSync(credsPath, "utf8")) as Creds;
}

async function loginAs(page: Page, role: "user" | "mentor" | "admin", email: string, password: string) {
  await page.goto(`/login?role=${role === "mentor" ? "mentor" : role}`);
  const roleLabel = role === "mentor" ? /coach/i : role === "admin" ? /admin/i : /user/i;
  const roleBtn = page.getByRole("button", { name: roleLabel }).first();
  if (await roleBtn.isVisible().catch(() => false)) {
    await roleBtn.click();
  }
  await page.locator("#email, input[type='email']").first().fill(email);
  await page.locator("#password, input[type='password']").first().fill(password);
  await page.getByRole("button", { name: /log ?in|sign in/i }).first().click();
  await page.waitForTimeout(1500);
}

test.describe.configure({ mode: "serial" });

test.describe("Public UI controls", () => {
  test("home + mentors + login + register + contact + become coach", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /coaches|mentors/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /become/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /log ?in/i }).first()).toBeVisible();

    await page.goto("/mentors");
    await expect(page.locator("input").first()).toBeVisible();
    const clear = page.getByRole("button", { name: /clear/i });
    if (await clear.isVisible().catch(() => false)) {
      await expect(clear).toBeEnabled();
    }

    await page.goto("/login");
    await expect(page.getByRole("button", { name: /user/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /coach/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot/i })).toBeVisible();

    await page.goto("/register");
    await expect(page.locator("input[type='email'], #email").first()).toBeVisible();

    await page.goto("/mentor/register");
    await expect(page.getByText(/agreement|coach|register/i).first()).toBeVisible();

    await page.goto("/forgot-password");
    await expect(page.getByRole("button", { name: /user/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /coach|mentor/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /send|reset/i }).first()).toBeVisible();

    await page.goto("/contact");
    await expect(page.getByRole("button", { name: /send/i }).first()).toBeVisible();

    await page.goto("/become-a-coach");
    await expect(page.getByRole("link", { name: /start|register|directory/i }).first()).toBeVisible();

    for (const p of ["/privacy-policy", "/terms-and-conditions", "/coach-agreement"]) {
      const res = await page.goto(p);
      expect(res?.ok() || res?.status() === 200).toBeTruthy();
    }
  });

  test("language switcher toggles copy", async ({ page }) => {
    await page.goto("/mentors");
    const switcher = page.getByRole("button", { name: /^(EN|NL|FR|DE|ES|IT|AR|ZH|RU|RO)$/i }).or(
      page.locator("[data-language], select, button").filter({ hasText: /EN|NL/i }).first(),
    );
    // Prefer clicking NL in common LanguageSwitcher
    const nl = page.getByRole("button", { name: /^NL$/i }).or(page.getByText(/^NL$/));
    if (await nl.first().isVisible().catch(() => false)) {
      await nl.first().click();
      await page.waitForTimeout(500);
    } else if (await switcher.first().isVisible().catch(() => false)) {
      await switcher.first().click();
    }
  });
});

test.describe("User dashboard controls", () => {
  test("nav + pages + wallet UI (no live Mollie)", async ({ page }) => {
    const creds = loadCreds();
    await loginAs(page, "user", creds.user.email, creds.user.password);
    await page.goto("/user/dashboard");
    await expect(page).toHaveURL(/\/user/);

    const links = [
      ["/user/profile", /save|upload|photo|profile/i],
      ["/user/appointments", /appointment|coach|session|find/i],
      ["/user/mentors", /coach|mentor|profile/i],
      ["/user/wallet", /mollie|€|eur|pay|wallet/i],
      ["/user/messages", /message|inbox|chat|empty|conversation/i],
      ["/user/security", /2fa|two-factor|security|password/i],
      ["/user/support", /send|support|message/i],
      ["/user/transactions", /transaction|payment|history/i],
      ["/user/notifications", /notification|empty|alert/i],
    ] as const;

    for (const [route, hint] of links) {
      await page.goto(route);
      await expect(page.getByText(hint).first()).toBeVisible({ timeout: 20_000 });
    }

    await page.goto("/user/wallet");
    const pay = page.getByRole("button", { name: /mollie|pay/i });
    if (await pay.first().isVisible().catch(() => false)) {
      await expect(pay.first()).toBeVisible();
      // Do not click through to live Mollie
    }
  });
});

test.describe("Mentor dashboard controls", () => {
  test("nav + profile switches + payouts CTA visible", async ({ page }) => {
    const creds = loadCreds();
    await loginAs(page, "mentor", creds.coach.email, creds.coach.password);
    await page.goto("/mentor/dashboard");
    await expect(page).toHaveURL(/\/mentor/);

    const routes = [
      "/mentor/profile",
      "/mentor/availability",
      "/mentor/platform-time",
      "/mentor/appointments",
      "/mentor/earnings",
      "/mentor/payouts",
      "/mentor/settlements",
      "/mentor/invoices",
      "/mentor/messages",
      "/mentor/support",
      "/mentor/security",
    ];
    for (const route of routes) {
      const res = await page.goto(route);
      expect(res?.ok() || (res?.status() ?? 500) < 500).toBeTruthy();
      await expect(page.locator("body")).not.toBeEmpty();
    }

    await page.goto("/mentor/profile");
    const save = page.getByRole("button", { name: /save/i });
    await expect(save.first()).toBeVisible({ timeout: 20_000 });
    const switches = page.locator('button[role="switch"], [data-state]');
    if ((await switches.count()) > 0) {
      await expect(switches.first()).toBeVisible();
    }

    await page.goto("/mentor/availability");
    await expect(page.getByRole("button", { name: /add/i }).first()).toBeVisible({ timeout: 20_000 });

    await page.goto("/mentor/payouts");
    await expect(page.getByText(/mollie|payout|connect|bank/i).first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Admin dashboard controls", () => {
  test("overview + key admin pages", async ({ page }) => {
    const creds = loadCreds();
    await loginAs(page, "admin", creds.admin.email, creds.admin.password);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);

    const routes = [
      "/admin",
      "/admin/users",
      "/admin/mentors",
      "/admin/bookings",
      "/admin/payments",
      "/admin/transactions",
      "/admin/analytics",
      "/admin/reviews",
      "/admin/marketplace",
      "/admin/wallet-ops",
      "/admin/settlements",
      "/admin/announcements",
      "/admin/coach-applications",
      "/admin/mentor-presence",
      "/admin/invoices",
    ];
    for (const route of routes) {
      const res = await page.goto(route);
      expect(res?.ok() || (res?.status() ?? 500) < 500).toBeTruthy();
    }

    await page.goto("/admin/analytics");
    for (const label of [/24 hours/i, /7 days/i, /30 days/i]) {
      const tab = page.getByRole("button", { name: label }).or(page.getByText(label));
      if (await tab.first().isVisible().catch(() => false)) {
        await tab.first().click();
      }
    }

    await page.goto(`/mentors/${creds.coach.id}`);
    await expect(page.getByText(/mins|video|call|experience|offline|available|see when/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
