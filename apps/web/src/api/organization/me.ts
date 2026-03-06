import { apiFetch, normalizeApiUrl } from "../client/client";
import type { OrganizationResponse } from "./update";

export async function getMyOrganization(): Promise<OrganizationResponse> {
  const org = await apiFetch<OrganizationResponse>("/organizations/me", {
    method: "GET",
  });
  return { ...org, avatar_url: normalizeApiUrl(org.avatar_url) };
}
