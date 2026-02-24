import {
  API_BASE_URL,
  apiGet,
  apiPost,
  handle429Error,
  parseErrorResponse,
} from "../client/client";

export type AuthSessionResponse = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  org_id: string;
  org_name: string;
  org_website: string;
  is_verified: boolean;
  is_onboarded: boolean;
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
};

export function login(payload: AuthPayload): Promise<unknown> {
  return apiPost<unknown>("/auth/login", payload);
}

export function signup(payload: AuthPayload): Promise<unknown> {
  return apiPost<unknown>("/auth/signup", payload);
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

  return (await res.json()) as AuthSessionResponse;
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
    const message = await parseErrorResponse(res, `Verification failed: ${res.status} ${res.statusText}`);
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
    const message = await parseErrorResponse(res, `Onboarding failed: ${res.status} ${res.statusText}`);
    throw new Error(message);
  }

  return (await res.json()) as AuthSessionResponse;
}

export type OrgUserResponse = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
};

export type InviteDetailsResponse = {
  org_name: string;
  role: string;
  email: string;
  account_exists: boolean;
};
