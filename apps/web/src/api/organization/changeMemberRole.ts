import { OrgUserResponse } from "../auth/auth";
import { apiFetch } from "../client/client";

export function updateOrgUserRole(userId: string, role: string): Promise<OrgUserResponse> {
  return apiFetch<OrgUserResponse>(`/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}
