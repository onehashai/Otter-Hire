import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.UI_TEST_ORIGIN || "http://127.0.0.1:3108";
const screenshots = process.env.UI_SCREENSHOT_DIR || "test-results/spam-control";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.context().addCookies([{ name: "access_token", value: "ui-fixture", url: origin }]);
let role = "owner";
let emails = [];
const domains = [{ id: "domain-1", domain: "naukri.com", created_at: "2026-09-23T12:00:00Z", created_by_user_id: null }];
const writes = [];
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname.replace("/v1/internal", "");
  const method = route.request().method();
  if (url.pathname.startsWith("/v1/internal/")) {
    const headers = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type",
    };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    const json = (payload) => route.fulfill({ json: payload, headers });
    if (path === "/auth/me") return json({ id: "fixture", name: "UI Test", org_id: "org", role: "user", membership_role: role, status: "active", is_verified: true, is_onboarded: true });
    if (path === "/organizations/blocked-domains") return json(domains);
    if (path === "/organizations/blocked-email-addresses") {
      if (method === "POST") {
        const body = route.request().postDataJSON();
        writes.push(body);
        const email = body.emails[0];
        if (!emails.some((row) => row.email === email)) emails.push({ id: "email-1", email, created_at: new Date().toISOString(), created_by_user_id: null });
        return json(emails.filter((row) => row.email === email));
      }
      return json(emails);
    }
    if (path === "/organizations/blocked-email-addresses/email-1" && method === "DELETE") {
      emails = [];
      return route.fulfill({ status: 204, headers });
    }
    return json([]);
  }
  if (url.origin !== origin) return route.abort();
  return route.continue();
});

const selectEmails = async () => {
  await page.getByRole("tab", { name: "Email addresses", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[role="tab"][data-state="active"]')?.textContent === "Email addresses");
};
const input = () => page.getByLabel("Email address", { exact: true });
const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "page must not overflow horizontally");
await mkdir(screenshots, { recursive: true });
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/settings/spam-control`);
  await page.getByRole("cell", { name: "naukri.com", exact: true }).waitFor();
  await selectEmails();
  await page.getByText("No email addresses are blocked.", { exact: true }).waitFor();
  await input().fill("not-an-email");
  await page.getByRole("button", { name: "Block email", exact: true }).click();
  await page.getByText("Enter a valid email address, such as sender@example.com", { exact: true }).waitFor();
  assert.equal(writes.length, 0);
  await input().fill(" Spam.User+Tag@GMAIL.COM ");
  await page.getByRole("button", { name: "Block email", exact: true }).click();
  await page.getByRole("cell", { name: "spam.user+tag@gmail.com", exact: true }).waitFor();
  assert.deepEqual(writes[0], { emails: ["spam.user+tag@gmail.com"] });
  await input().fill("spam.user+tag@gmail.com");
  await page.getByRole("button", { name: "Block email", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#blocked-sender")?.value === "");
  assert.equal(await page.getByRole("cell", { name: "spam.user+tag@gmail.com", exact: true }).count(), 1);
  await page.getByLabel("Search blocked email addresses").fill("not-found");
  await page.getByText("No blocked senders match your search.", { exact: true }).waitFor();
  await page.getByLabel("Search blocked email addresses").fill("USER");
  await page.getByRole("cell", { name: "spam.user+tag@gmail.com", exact: true }).waitFor();
  await page.getByRole("button", { name: "Unblock spam.user+tag@gmail.com", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(emails.length, 1);
  await page.getByRole("button", { name: "Unblock spam.user+tag@gmail.com", exact: true }).click();
  await page.getByRole("button", { name: "Unblock", exact: true }).click();
  await page.getByLabel("Search blocked email addresses").fill("");
  await page.getByText("No email addresses are blocked.", { exact: true }).waitFor();
  await input().fill("spam.user+tag@gmail.com");
  await page.getByRole("button", { name: "Block email", exact: true }).click();
  await page.getByRole("cell", { name: "spam.user+tag@gmail.com", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Domains", exact: true }).click();
  await page.getByRole("cell", { name: "naukri.com", exact: true }).waitFor();
  assert.equal(domains.length, 1);
  await page.reload();
  await selectEmails();
  await page.getByRole("cell", { name: "spam.user+tag@gmail.com", exact: true }).waitFor();
  await fits();
  await page.screenshot({ path: `${screenshots}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await selectEmails();
  await page.getByRole("cell", { name: "spam.user+tag@gmail.com", exact: true }).waitFor();
  await fits();
  await page.screenshot({ path: `${screenshots}/mobile.png`, fullPage: true });
  role = "member";
  await page.reload();
  await selectEmails();
  assert.equal(await input().isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Block email", exact: true }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log("Spam Control desktop/mobile checks passed: validation, add, duplicate, search, confirmation, unblock, refresh, domain preservation and member permissions.");
} finally {
  await browser.close();
}
