import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.UI_TEST_ORIGIN || "http://127.0.0.1:3100";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 950 } });
await page.context().addCookies([{ name: "access_token", value: "ui-fixture", url: origin }]);
const writes = [];
let mode = "new";
let polls = 0;
let selected;
const integrations = [
  { id: "api", provider: "workable", connection_type: "api", status: "connected" },
  { id: "mcp", provider: "ashby", connection_type: "native_mcp", status: "connected",
    provider_details: { mcp_import_contract: { ready: true } } },
];
const batch = (id, integration_id, status) => ({ id, integration_id, source: "workable",
  status, total_rows: 2, valid_rows: 2, error_rows: 0, flagged_rows: 0,
  entity_counts: { job: 1, candidate: 1 }, created_at: new Date().toISOString() });
await page.route("**/*", async route => {
  const url = new URL(route.request().url());
  const path = url.pathname.replace("/v1/internal", "");
  if (url.pathname.startsWith("/v1/internal/")) {
    const json = payload => route.fulfill({ json: payload });
    if (path === "/auth/me") return json({ id: "fixture", name: "UI Test", org_id: "org",
      role: "owner", membership_role: "owner", status: "active", is_verified: true, is_onboarded: true });
    if (path === "/ats-migrations/integrations") return json(integrations);
    if (path === "/ats-migrations/mcp/providers") return json([{ ats_name: "ashby",
      mcp_status: "native_ga", auth_type: "oauth", connection_ready: true,
      supported_operations: ["read"], mcp_server_url: "https://example.test/mcp" }]);
    if (path === "/ats-migrations/batches") return json([batch("old-history", "api", "completed")]);
    if (route.request().method() === "POST") {
      writes.push(path);
      if (path.endsWith("/sync")) {
        const integrationId = path.split("/")[3];
        selected = batch(`${integrationId}-new`, integrationId, "pending_approval");
        polls = 0;
        await new Promise(resolve => setTimeout(resolve, 500));
        if (mode === "error") return route.fulfill({ status: 403, json: { detail: "Provider access denied" } });
        return json(mode === "pending" ? { batch_id: selected.id } : { workflow_id: "run-123" });
      }
      if (path.endsWith("/approve")) selected.status = "approval_queued";
      if (path.endsWith("/reject")) selected.status = "rejected";
      return json({ status: selected.status });
    }
    if (path.endsWith("/sync/run-123")) return json(++polls < 2 ? { status: "syncing" } : { batch_id: selected.id });
    if (path.startsWith("/ats-migrations/batches/")) return json(selected);
    return json([]);
  }
  if (url.origin !== origin) return route.abort();
  return route.continue();
});

try {
  await page.goto(`${origin}/data-migration`);
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 1500 });
  await dialog.getByText("Fetching records for approval...").waitFor();
  await dialog.getByRole("button", { name: "Approve batch", exact: true }).waitFor();
  assert.equal(await dialog.getByText("old-history").count(), 0);
  assert.equal(writes.filter(path => path.endsWith("/sync")).length, 1);
  assert.equal(writes.some(path => path.endsWith("/approve")), false);
  assert.deepEqual(await dialog.getByRole("button").allTextContents(), ["", "Approve batch", "Reject batch"]);
  await dialog.getByRole("button", { name: "Approve batch" }).click();
  await dialog.getByText("Import in progress", { exact: true }).waitFor();
  assert.equal(writes.filter(path => path.endsWith("/approve")).length, 1);
  selected.status = "completed";
  await dialog.getByText("completed", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Close imports" }).click();

  mode = "pending";
  await page.getByRole("tab", { name: "MCP", exact: true }).click();
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await dialog.getByRole("button", { name: "Reject batch" }).waitFor();
  await page.setViewportSize({ width: 375, height: 812 });
  const fits = await dialog.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  });
  assert.equal(fits, true);
  page.once("dialog", d => d.accept());
  await dialog.getByRole("button", { name: "Reject batch" }).click();
  await dialog.getByText("rejected", { exact: true }).waitFor();
  assert.equal(writes.filter(path => path.endsWith("/approve")).length, 1);
  await dialog.getByRole("button", { name: "Close imports" }).click();

  mode = "error";
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await dialog.getByRole("alert").getByText("Provider access denied").waitFor();
  assert.equal(await dialog.getByRole("button", { name: "Approve batch" }).count(), 0);
  console.log("PASS: immediate popup, exact batch, API approval, MCP rejection, no automatic transfer, mobile layout, visible sync errors");
} finally {
  await browser.close();
}
