const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const INTERNAL_API_BASE_URL = process.env.API_INTERNAL_URL ?? PUBLIC_API_BASE_URL;

export const API_BASE_URL =
  typeof window === "undefined" ? INTERNAL_API_BASE_URL : PUBLIC_API_BASE_URL;

export type HealthResponse = {
  status: string;
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

export type AuthSessionResponse = {
  id: string;
  email: string;
  name: string;
  role: string;
  org_id: string;
  org_name: string;
  is_verified: boolean;
  is_onboarded: boolean;
};

type AuthPayload = {
  email: string;
  password: string;
  name?: string;
};

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `Too many attempts. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

function handle429Error(res: Response): string {
  const retryAfter = res.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds) && seconds > 0) {
      return formatRetryAfter(seconds);
    }
  }
  return "Too many attempts. Please try again later.";
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: AuthPayload): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(handle429Error(res));
    }
    
    let message = `API request failed: ${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { detail?: string };
      if (typeof data.detail === "string" && data.detail.trim()) {
        message = data.detail;
      }
    } catch {}
    throw new Error(message);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/health");
}

export function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>("/me");
}

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
    
    let message = `Verification failed: ${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { detail?: string };
      if (typeof data.detail === "string" && data.detail.trim()) {
        message = data.detail;
      }
    } catch {}
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
    let message = `Onboarding failed: ${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { detail?: string };
      if (typeof data.detail === "string" && data.detail.trim()) {
        message = data.detail;
      }
    } catch {}
    throw new Error(message);
  }

  return (await res.json()) as AuthSessionResponse;
}
