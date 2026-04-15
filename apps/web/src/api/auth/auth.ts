import { refresh401MeansSessionExpired } from "@/lib/auth-refresh-codes";
import {
  API_BASE_URL,
  apiGet,
  apiPost,
  handle429Error,
  normalizeApiUrl,
  parseErrorResponse,
} from "../client/client";

export type AuthSessionResponse = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  role: string;
  membership_role: string;
  status: string;
  org_id: string;
  org_name: string;
  org_website: string;
  org_avatar_url?: string | null;
  is_verified: boolean;
  is_onboarded: boolean;
  auth_provider?: string; // "email" | "google" | "email,google" | "google,email"
  preferences?: Record<string, unknown>;
};

export type MeResponse = {
  org_id: string | null;
  org_name?: string;
  user: {
    id: string | null;
    email: string | null;
    role: string | null;
    status: string | null;
  };
};

export type AuthPayload = {
  email: string;
  password: string;
  name?: string;
  invite_token?: string;
};

export function login(payload: AuthPayload): Promise<unknown> {
  return apiPost<unknown>("/auth/login", payload);
}

export function signup(payload: AuthPayload): Promise<unknown> {
  return apiPost<unknown>("/auth/signup", payload);
}

/** Normalize `/auth/me` payload: older APIs used `role` for org membership only. */
function normalizeAuthSessionPayload(raw: Record<string, unknown>): AuthSessionResponse {
  const base = raw as unknown as AuthSessionResponse;
  const withRoles =
    typeof raw.membership_role === "string"
      ? base
      : {
          ...base,
          role: "user",
          membership_role: String(raw.role ?? ""),
        };
  return {
    ...withRoles,
    org_avatar_url: normalizeApiUrl(withRoles.org_avatar_url),
    avatar_url: normalizeApiUrl(withRoles.avatar_url),
  };
}

export async function logout(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
}

export type RefreshSessionResult =
  | { ok: true; user: AuthSessionResponse }
  | { ok: false; sessionInvalidated: boolean };

export async function refreshSessionDetailed(): Promise<RefreshSessionResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });

    if (res.ok) {
      const raw = (await res.json()) as Record<string, unknown>;
      return { ok: true, user: normalizeAuthSessionPayload(raw) };
    }

    if (res.status === 401) {
      let code: string | undefined;
      try {
        const body = (await res.json()) as { code?: string };
        code = typeof body.code === "string" ? body.code : undefined;
      } catch {
        code = undefined;
      }
      return { ok: false, sessionInvalidated: refresh401MeansSessionExpired(code) };
    }

    return { ok: false, sessionInvalidated: false };
  } catch {
    return { ok: false, sessionInvalidated: false };
  }
}

export async function refreshSession(): Promise<AuthSessionResponse | null> {
  const r = await refreshSessionDetailed();
  return r.ok ? r.user : null;
}

export async function getAuthSession(): Promise<AuthSessionResponse | null> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 401) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeAuthSessionPayload(raw);
}

export function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>("/me", { credentials: "include" });
}

export async function verifyEmail(token: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(handle429Error(res));
    }
    const message = await parseErrorResponse(
      res,
      `Verification failed: ${res.status} ${res.statusText}`,
    );
    throw new Error(message);
  }

  return (await res.json()) as { ok: boolean };
}

export async function resendVerification(email: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(handle429Error(res));
    }
    throw new Error(`Resend failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { ok: boolean };
}

export async function getGoogleAuthEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/google/enabled`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled: boolean };
    return data.enabled;
  } catch {
    return false;
  }
}

export async function completeOnboarding(data: {
  full_name: string;
  organization_name: string;
}): Promise<AuthSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const message = await parseErrorResponse(
      res,
      `Onboarding failed: ${res.status} ${res.statusText}`,
    );
    throw new Error(message);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeAuthSessionPayload(raw);
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(handle429Error(res));
    }
    const message = await parseErrorResponse(
      res,
      `Request failed: ${res.status} ${res.statusText}`,
    );
    throw new Error(message);
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, new_password: newPassword }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(handle429Error(res));
    }
    const message = await parseErrorResponse(res, `Reset failed: ${res.status} ${res.statusText}`);
    throw new Error(message);
  }
}

export type OrgUserResponse = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  avatar_url?: string | null;
};

export type InviteDetailsResponse = {
  org_name: string;
  role: string;
  email: string;
  account_exists: boolean;
  status: string;
  suggested_name?: string | null;
};
