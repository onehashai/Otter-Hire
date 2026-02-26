import { OrgUserResponse } from "../auth/auth";
import { apiFetch } from "../client/client";

export function getOrgUsers(): Promise<OrgUserResponse[]> {
  return apiFetch<OrgUserResponse[]>("/users", { method: "GET" });
}
