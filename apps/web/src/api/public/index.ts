import { API_BASE_URL, apiFetch, apiGet, normalizeApiUrl } from "../client/client";

export type PublicJobListItem = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  employment_type: string | null;
  workplace_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_fixed: number | null;
  currency: string;
  salary_timeframe: string;
  published_at: string;
  status: string;
};

export type PublicJobsListResponse = {
  jobs: PublicJobListItem[];
  org_name: string;
  org_avatar_url: string | null;
  jobs_page_language: string;
};

export type PublicJobDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  employment_type: string;
  workplace_type: string;
  country: string | null;
  city: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_fixed: number | null;
  currency: string;
  salary_timeframe: string;
  published_at: string;
  org_name: string;
  org_avatar_url: string | null;
  status: string;
  application_form_schema: Record<string, unknown>;
  jobs_page_language: string;
};

export type PublicApplyPayload = {
  full_name: string;
  email: string;
  phone?: string | null;
  answers: Record<string, unknown>;
  files?: Record<string, unknown> | null;
};

export type PublicApplyResponse = {
  id: string;
  status: string;
};

export type PublicApplyFileUploadResponse = {
  key: string;
  name: string;
  content_type: string | null;
  size_bytes: number;
  url: string;
};

function getPublicApiBase(): string {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const host = window.location.host;
    if (host.includes("otter.bz")) {
      return `${protocol}//app.otter.bz/v1/internal`;
    }
    if (host.includes("smartats.in")) {
      return `${protocol}//app.smartats.in/v1/internal`;
    }
    return `${protocol}//${host}/v1/internal`;
  }
  return API_BASE_URL;
}

export async function getPublicJobs(orgId: string): Promise<PublicJobsListResponse> {
  const baseUrl = getPublicApiBase();
  const res = await fetch(`${baseUrl}/orgs/${orgId}/jobs`);
  if (!res.ok) {
    throw new Error(`Failed to load jobs (${res.status})`);
  }
  const data = (await res.json()) as PublicJobsListResponse;
  return { ...data, org_avatar_url: normalizeApiUrl(data.org_avatar_url) };
}

export async function getPublicJobDetail(orgId: string, jobId: string): Promise<PublicJobDetail> {
  const baseUrl = getPublicApiBase();
  const res = await fetch(`${baseUrl}/orgs/${orgId}/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`Job not found (${res.status})`);
  }
  const data = (await res.json()) as PublicJobDetail;
  return { ...data, org_avatar_url: normalizeApiUrl(data.org_avatar_url) };
}

export async function applyToPublicJob(
  orgId: string,
  jobId: string,
  payload: PublicApplyPayload,
  options?: { idempotencyKey?: string },
): Promise<PublicApplyResponse> {
  const extra: Record<string, string> = {};
  if (options?.idempotencyKey) {
    extra["Idempotency-Key"] = options.idempotencyKey;
  }
  return apiFetch<PublicApplyResponse>(`/orgs/${orgId}/jobs/${jobId}/apply`, {
    method: "POST",
    body: payload,
    headers: Object.keys(extra).length ? extra : undefined,
  });
}

export async function uploadPublicApplicationFile(
  orgId: string,
  jobId: string,
  fieldKey: string,
  file: File,
): Promise<PublicApplyFileUploadResponse> {
  const form = new FormData();
  form.append("field_key", fieldKey);
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/jobs/${jobId}/apply/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    let message = `Upload failed: ${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { detail?: string; error?: string };
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : typeof data.error === "string"
            ? data.error
            : "";
      if (detail.trim()) message = detail;
    } catch {}
    throw new Error(message);
  }
  const data = (await res.json()) as PublicApplyFileUploadResponse;
  // Keep backend-local URL as-is so apply payload stores canonical object reference.
  return data;
}
