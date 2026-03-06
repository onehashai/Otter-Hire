import { API_BASE_URL, apiFetch, normalizeApiUrl } from "../client/client";

export type ProfileResponse = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
};

export async function getMyProfile(): Promise<ProfileResponse> {
  const profile = await apiFetch<ProfileResponse>("/users/me/profile", { method: "GET" });
  return { ...profile, avatar_url: normalizeApiUrl(profile.avatar_url) };
}

export async function updateMyProfile(name: string): Promise<ProfileResponse> {
  const profile = await apiFetch<ProfileResponse>("/users/me/profile", {
    method: "PATCH",
    body: { name },
  });
  return { ...profile, avatar_url: normalizeApiUrl(profile.avatar_url) };
}

export async function uploadMyAvatar(file: File): Promise<ProfileResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/users/me/avatar`, {
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
  const profile = (await res.json()) as ProfileResponse;
  return { ...profile, avatar_url: normalizeApiUrl(profile.avatar_url) };
}

export async function deleteMyAvatar(): Promise<ProfileResponse> {
  const profile = await apiFetch<ProfileResponse>("/users/me/avatar", { method: "DELETE" });
  return { ...profile, avatar_url: normalizeApiUrl(profile.avatar_url) };
}
