import { apiFetch, normalizeApiUrl } from "../client/client";

export type OrganizationResponse = {
  id: string;
  name: string;
  website: string | null;
  avatar_url?: string | null;
  jobs_page_language: string;
  catch_all_email?: string | null;
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

export async function updateOrganizationLanguage(
  jobs_page_language: string,
): Promise<OrganizationResponse> {
  const org = await apiFetch<OrganizationResponse>("/organizations/me/language", {
    method: "PATCH",
    body: { jobs_page_language },
  });
  return { ...org, avatar_url: normalizeApiUrl(org.avatar_url) };
}
