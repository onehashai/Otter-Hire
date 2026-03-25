/** Careers URLs use `{slugPrefix}-{uuid}` where the last five segments are the org id. */
export function parseOrgSlug(orgSlug: string): { orgName: string; orgId: string } | null {
  const parts = orgSlug.split("-");
  if (parts.length < 6) return null;

  const uuidParts = parts.slice(-5);
  const orgId = uuidParts.join("-");
  const orgName = parts.slice(0, -5).join("-");

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) return null;

  return { orgName, orgId };
}
