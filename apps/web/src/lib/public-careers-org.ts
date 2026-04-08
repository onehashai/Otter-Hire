const CAREERS_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** First path segment for careers URLs is the organization UUID. */
export function parseCareersOrgId(segment: string): string | null {
  const s = (segment || "").trim();
  return CAREERS_UUID_RE.test(s) ? s : null;
}

export function isCareersUuidSegment(segment: string): boolean {
  return parseCareersOrgId(segment) !== null;
}

/**
 * Legacy careers URLs used `{slugPrefix}-{uuid}` where the last five hyphen
 * segments are the org id (same rule as the former `parseOrgSlug`).
 */
export function parseLegacyCareersOrgSlug(
  orgSlug: string,
): { orgName: string; orgId: string } | null {
  const parts = orgSlug.split("-");
  if (parts.length < 6) return null;

  const uuidParts = parts.slice(-5);
  const orgId = uuidParts.join("-");
  const orgName = parts.slice(0, -5).join("-");

  if (!CAREERS_UUID_RE.test(orgId)) return null;

  return { orgName, orgId };
}
