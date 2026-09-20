import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.UI_TEST_ORIGIN || "http://127.0.0.1:3100";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
await context.addCookies([{ name: "access_token", value: "ui-fixture", url: origin }]);
const page = await context.newPage();
const errors = [];
const writes = [];
let role = "owner";
let status;
const reset = () => { status = { connected: false, status: "not_connected", oauth_configured: true,
  distribution_enabled: true, lead_sync_enabled: true, can_post: false, can_sync_leads: false }; };
reset();
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  const path = url.pathname.replace("/v1/internal", "");
  const method = route.request().method();
  if (url.pathname === "/oauth-fixture") {
    status = { ...status, connected: true, status: "pending", setup_complete: false, can_sync_leads: true };
    return route.fulfill({ contentType: "text/html", body: `<script>window.opener.postMessage({type:'linkedin_oauth_complete'}, ${JSON.stringify(origin)});</script>` });
  }
  if (url.pathname.startsWith("/v1/internal/")) {
    const headers = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "content-type" };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    const json = payload => route.fulfill({ json: payload, headers });
    if (method !== "GET") writes.push({ path, method, body: route.request().postDataJSON() });
    if (path === "/auth/me") return json({ id: "fixture", name: "UI Test", org_id: "org", role,
      membership_role: role, status: "active", is_verified: true, is_onboarded: true });
    if (path === "/integrations/apps") return json({ items: [
      { app_id: "linkedin", slug: "linkedin", name: "LinkedIn", category: "social", description: "LinkedIn", installed: false },
    ] });
    if (path === "/integrations/linkedin/status") return json(status);
    if (path === "/integrations/linkedin/connect") return json({ authorization_url: `${origin}/oauth-fixture`, callback_origin: origin, state: "fixture" });
    if (path === "/integrations/linkedin/organizations") return json({ organizations: [{ id: "123", name: "Test Company", vanity_name: "test" }] });
    if (path === "/integrations/linkedin/complete-setup") {
      status = { ...status, setup_complete: true, status: "active", can_post: true, organization: { id: "123", name: "Test Company" } };
      return json({ message: "Connected" });
    }
    if (path === "/integrations/linkedin/lead-subscription") {
      status = { ...status, lead_subscription: { id: "subscription", status: "active", owner: { sponsoredAccount: "urn:li:sponsoredAccount:456" } } };
      return json(status.lead_subscription);
    }
    if (path === "/jobs" && method === "POST") return json({ id: "created-job", title: "Test job", status: "draft" });
    if (path === "/jobs") return json([]);
    return json([]);
  }
  if (url.origin !== origin) return route.abort();
  return route.continue();
});
await mkdir("test-results/linkedin", { recursive: true });
try {
  for (const width of [1440, 390]) {
    reset();
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/settings/integrations`);
    await page.getByRole("switch", { name: "LinkedIn connection", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Coming Soon", exact: true }).count(), 0);
    await page.getByRole("switch", { name: "Include Lead Sync permission", exact: true }).click();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Test Company", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByText("Connected", { exact: true }).waitFor();
    await page.getByRole("textbox", { name: "LinkedIn ad account ID" }).fill("456");
    await page.getByRole("button", { name: "Connect Lead Forms" }).click();
    await page.getByText("Lead Sync: Connected", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `test-results/linkedin/settings-${width}.png`, fullPage: true });
    await page.goto(`${origin}/jobs`);
    await page.getByRole("button", { name: /create job/i }).first().click();
    await page.getByRole("dialog").getByRole("switch", { name: "Post to LinkedIn" }).waitFor();
    assert.equal(await page.getByRole("dialog").getByRole("switch", { name: "Post to LinkedIn" }).isEnabled(), true);
    await page.getByRole("dialog").getByRole("switch", { name: "Post to LinkedIn" }).click();
    await page.screenshot({ path: `test-results/linkedin/create-${width}.png`, fullPage: true });
    await page.getByRole("dialog").getByRole("button", { name: /cancel/i }).click();
  }
  role = "interviewer";
  await page.goto(`${origin}/settings/integrations`);
  await page.getByText("Administrator access required").waitFor();
  assert.equal(await page.getByRole("switch", { name: "LinkedIn connection", exact: true }).count(), 0);
  assert.equal(writes.filter(w => w.path.endsWith("complete-setup")).length, 2);
  assert.equal(writes.filter(w => w.path.endsWith("lead-subscription")).length, 2);
  assert.deepEqual(errors, []);
  console.log("PASS: LinkedIn OAuth popup, Company Page setup, Lead Sync, job toggle and permissions at desktop/mobile widths. All API requests mocked.");
} finally {
  await browser.close();
}
