import { apiFetch } from "../client/client";

export type OrganizationResponse = {
  id: string;
  name: string;
  website: string | null;
  avatar_url?: string | null;
};

export function updateOrganization(data: {
  name: string;
  website: string | null;
}): Promise<OrganizationResponse> {
  return apiFetch<OrganizationResponse>("/organizations/me", {
    method: "PATCH",
    body: data,
  });
}
