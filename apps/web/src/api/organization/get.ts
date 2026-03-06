import { OrgUserResponse } from "../auth/auth";
import { apiFetch, normalizeApiUrl } from "../client/client";

export async function getOrgUsers(): Promise<OrgUserResponse[]> {
  const users = await apiFetch<OrgUserResponse[]>("/users", { method: "GET" });
  return users.map((user) => ({ ...user, avatar_url: normalizeApiUrl(user.avatar_url) }));
}
