import { apiFetch } from "../client/client";
import type { OrganizationMembership } from "./memberships";

export function createOrganization(name: string): Promise<OrganizationMembership> {
  return apiFetch<OrganizationMembership>("/organizations", {
    method: "POST",
    body: { name },
  });
}
