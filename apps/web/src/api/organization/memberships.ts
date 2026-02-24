import { apiFetch } from "../client/client";

export type OrganizationMembership = {
  org_id: string;
  org_name: string;
  org_website: string | null;
  role: string;
  status: string;
};

export function getOrganizationMemberships(): Promise<OrganizationMembership[]> {
  return apiFetch<OrganizationMembership[]>("/organizations/memberships", {
    method: "GET",
  });
}

export function switchOrganization(orgId: string): Promise<OrganizationMembership> {
  return apiFetch<OrganizationMembership>("/organizations/switch", {
    method: "POST",
    body: { org_id: orgId },
  });
}
