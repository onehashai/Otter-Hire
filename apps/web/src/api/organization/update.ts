import { apiFetch, normalizeApiUrl } from "../client/client";

export type OrganizationResponse = {
  id: string;
  name: string;
  website: string | null;
  avatar_url?: string | null;
};

export async function updateOrganization(data: {
  name: string;
  website: string | null;
}): Promise<OrganizationResponse> {
  const org = await apiFetch<OrganizationResponse>("/organizations/me", {
    method: "PATCH",
    body: data,
  });
  return { ...org, avatar_url: normalizeApiUrl(org.avatar_url) };
}
