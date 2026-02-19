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

export type JobHiringStageResponse = {
  id: string;
  name: string;
  position: number;
};

export type JobTeamMemberResponse = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
};

export type JobListItemResponse = {
  id: string;
  title: string;
  department: string | null;
  employment_type: string | null;
  status: string;
  candidate_count: number;
  created_at: string;
  updated_at: string;
};

export type JobDetailResponse = {
  id: string;
  title: string;
  department: string | null;
  employment_type: string | null;
  workplace_type: string | null;
  country: string | null;
  city: string | null;
  openings: number;
  salary_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_fixed: number | null;
  currency: string | null;
  salary_timeframe: string | null;
  description: string | null;
  status: string;
  visibility: string;
  collect_resume: boolean;
  collect_cover: boolean;
  screening_questions: string[];
  pipeline_template: string | null;
  hiring_stages: JobHiringStageResponse[];
  team_members: JobTeamMemberResponse[];
  created_by_user_id: string;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobUpdatePayload = {
  title?: string;
  department?: string | null;
  employment_type?: string | null;
  workplace_type?: string;
  country?: string | null;
  city?: string | null;
  openings?: number;
  salary_type?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_fixed?: number | null;
  currency?: string;
  salary_timeframe?: string;
  description?: string | null;
  visibility?: string;
  collect_resume?: boolean;
  collect_cover?: boolean;
  screening_questions?: string[];
  pipeline_template?: string;
  hiring_stages?: { name: string; position: number }[];
  team_members?: { user_id: string; role: string }[];
};

async function apiFetch<T>(
  path: string,
  options: { method: string; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(handle429Error(res));
    }
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { detail?: string; error?: string };
      const msg = typeof data.detail === "string" ? data.detail : typeof data.error === "string" ? data.error : "";
      if (msg.trim()) message = msg;
    } catch {}
    throw new Error(message);
  }

  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

export function getJobs(): Promise<JobListItemResponse[]> {
  return apiFetch<JobListItemResponse[]>("/jobs", { method: "GET" });
}

export function getJobById(id: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}`, { method: "GET" });
}

export function createJob(title: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>("/jobs", {
    method: "POST",
    body: { title },
  });
}

export function updateJob(
  id: string,
  payload: JobUpdatePayload,
): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function publishJob(id: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}/publish`, {
    method: "POST",
  });
}

export function closeJob(id: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}/close`, {
    method: "POST",
  });
}

export function unpublishJob(id: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}/unpublish`, {
    method: "POST",
  });
}
