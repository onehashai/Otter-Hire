import { API_BASE_URL, apiFetch, normalizeApiUrl } from "../client/client";
import type { OrganizationResponse } from "./update";

export async function uploadOrganizationAvatar(file: File): Promise<OrganizationResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/organizations/me/avatar`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { detail?: string; error?: string };
      const msg =
        typeof data.detail === "string"
          ? data.detail
          : typeof data.error === "string"
            ? data.error
            : "";
      if (msg.trim()) message = msg;
    } catch {}
    throw new Error(message);
  }
  const org = (await res.json()) as OrganizationResponse;
  return { ...org, avatar_url: normalizeApiUrl(org.avatar_url) };
}

export async function deleteOrganizationAvatar(): Promise<OrganizationResponse> {
  const org = await apiFetch<OrganizationResponse>("/organizations/me/avatar", {
    method: "DELETE",
  });
  return { ...org, avatar_url: normalizeApiUrl(org.avatar_url) };
}
