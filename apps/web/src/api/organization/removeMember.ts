import { apiFetch } from "../client/client";

export async function removeOrgUser(userId: string): Promise<void> {
    await apiFetch<Record<string, never>>(`/users/${userId}`, {
      method: "DELETE",
    });
  }