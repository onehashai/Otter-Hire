import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.UI_TEST_ORIGIN || "http://127.0.0.1:3100";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.context().addCookies([{ name: "access_token", value: "ui-fixture", url: origin }]);
let role = "owner";
let keys = [];
const writes = [];
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/*", async route => {
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
    const json = payload => route.fulfill({ json: payload, headers });
    if (path === "/auth/me") return json({ id: "fixture", name: "UI Test", org_id: "org",
      role, membership_role: role, status: "active", is_verified: true, is_onboarded: true });
    if (method !== "GET") writes.push({ path, method, body: route.request().postData() });
    if (path === "/integrations/apps") return json({ items: [
      { app_id: "email", slug: "email-integration", name: "Email", category: "email", description: "Email integration", installed: false },
      { app_id: "linkedin", slug: "linkedin", name: "LinkedIn", category: "social", description: "LinkedIn integration", installed: false },
    ] });
    if (path === "/import-export/api-keys") {
      if (method === "POST") {
        keys = [{ id: "key-1", name: "External integration", prefix: "otter_test", active: true,
          created_at: new Date().toISOString(), last_used_at: null }];
        return json({ key: "otter_test_fixture_secret" });
      }
      return json({ items: keys });
    }
    if (path === "/import-export/api-keys/key-1") {
      keys[0].active = false;
      return route.fulfill({ status: 204, headers });
    }
    if (path === "/mcp-keys") return json({ key: "mcp_fixture_secret" });
    return json([]);
  }
  if (url.origin !== origin) return route.abort();
  return route.continue();
});

const fits = async () => assert.equal(await page.evaluate(() =>
  document.documentElement.scrollWidth <= innerWidth), true, "page must not overflow horizontally");
await mkdir("test-results/settings-guides", { recursive: true });
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/settings/integrations`);
    await page.getByText("Email", { exact: true }).waitFor();
    await page.getByText("LinkedIn", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Generate key", exact: true }).count(), 0);
    assert.equal(await page.getByText("AI Client Connection (MCP)").count(), 0);
    await page.getByRole("link", { name: "API Key", exact: true }).click();
    await page.getByRole("heading", { name: "API Key", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/settings/api-keys");
    assert.equal(await page.getByRole("link", { name: "API Key", exact: true }).getAttribute("aria-current"), "page");
    await fits();
    if (width === 1440) {
      await page.getByRole("button", { name: "Generate key", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Generate", exact: true }).click();
      await page.getByText("otter_test_fixture_secret", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.getByRole("button", { name: "Revoke", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Revoke", exact: true }).click();
      await page.getByText("Revoked", { exact: true }).waitFor();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    await page.screenshot({ path: `test-results/settings-guides/api-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "MCP Server", exact: true }).click();
    await page.getByRole("heading", { name: "MCP Server", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/settings/mcp-server");
    if (width === 1440) {
      await page.getByRole("button", { name: "Generate MCP key", exact: true }).click();
      await page.getByText("mcp_fixture_secret", { exact: true }).waitFor();
      assert.equal(JSON.parse(writes.find(w => w.path === "/mcp-keys").body).scope, "read_only");
    }
    await fits();
    await page.screenshot({ path: `test-results/settings-guides/mcp-${width}.png`, fullPage: true });
    await page.goto(`${origin}/data-migration`);
    for (const [provider, name] of Object.entries({ greenhouse: "Greenhouse", lever: "Lever",
      workday: "Workday", icims: "iCIMS", smartrecruiters: "SmartRecruiters", bamboohr: "BambooHR", workable: "Workable" })) {
      const card = page.getByRole("heading", { name, exact: true }).locator("../..").locator("..");
      await card.getByRole("button", { name: "Connect", exact: true }).click();
      const guide = page.locator(`[data-credential-guide="${provider}"]`);
      await guide.waitFor();
      assert.ok(await guide.locator("ol > li").count() >= 4);
      assert.equal(await guide.getByRole("link").count(), 2);
      assert.equal(await guide.evaluate(el => el.getBoundingClientRect().bottom <=
        el.parentElement.querySelector("input, textarea").getBoundingClientRect().top), true);
      await fits();
    }
    await page.screenshot({ path: `test-results/settings-guides/workable-${width}.png`, fullPage: true });
  }
  role = "member";
  await page.goto(`${origin}/settings/api-keys`);
  await page.getByText("Owner or admin access is required to manage API keys.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Generate key", exact: true }).isDisabled(), true);
  await page.goto(`${origin}/settings/mcp-server`);
  await page.getByText("Only organization owners and administrators can generate connection keys.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Generate MCP key", exact: true }).isDisabled(), true);
  assert.equal(writes.length, 3, "Only explicitly requested fixture key operations should write");
  assert.deepEqual(errors, []);
  console.log("PASS: settings routes, email/LinkedIn retained, key generation/revocation, MCP key, member restrictions, seven guides above fields, desktop/mobile layout");
} finally {
  await browser.close();
}
