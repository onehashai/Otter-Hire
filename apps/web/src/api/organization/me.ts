import { apiFetch } from "../client/client";
import type { OrganizationResponse } from "./update";

export function getMyOrganization(): Promise<OrganizationResponse> {
  return apiFetch<OrganizationResponse>("/organizations/me", {
    method: "GET",
  });
}
