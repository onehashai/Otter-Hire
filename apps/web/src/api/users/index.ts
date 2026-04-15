import { API_BASE_URL, apiFetch, normalizeApiUrl, parseErrorResponse } from "../client/client";

export type ProfileResponse = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
};

export type UserPreferencesResponse = {
  preferences: Record<string, unknown>;
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

export async function getMyPreferences(): Promise<UserPreferencesResponse> {
  return apiFetch<UserPreferencesResponse>("/users/me/preferences", { method: "GET" });
}

export async function updateMyPreferences(
  preferences: Record<string, unknown>,
): Promise<UserPreferencesResponse> {
  return apiFetch<UserPreferencesResponse>("/users/me/preferences", {
    method: "PATCH",
    body: { preferences },
  });
}

export type SecurityStatusResponse = {
  auth_provider: string;
  has_password: boolean;
  google_connected: boolean;
};

export async function getSecurityStatus(): Promise<SecurityStatusResponse> {
  return apiFetch<SecurityStatusResponse>("/users/me/security", { method: "GET" });
}

export async function createPassword(
  new_password: string,
  confirm_password: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/users/me/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ new_password, confirm_password }),
  });
  if (!res.ok) {
    const message = await parseErrorResponse(res, `Failed to set password: ${res.status}`);
    throw new Error(message);
  }
}

export async function updatePassword(
  current_password: string,
  new_password: string,
  confirm_password: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/users/me/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ current_password, new_password, confirm_password }),
  });
  if (!res.ok) {
    const message = await parseErrorResponse(res, `Failed to update password: ${res.status}`);
    throw new Error(message);
  }
}

export async function disconnectGoogle(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/users/me/google`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const message = await parseErrorResponse(res, `Failed to disconnect Google: ${res.status}`);
    throw new Error(message);
  }
}
