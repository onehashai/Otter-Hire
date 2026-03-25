import { apiFetch, apiGet, normalizeApiUrl } from "../client/client";

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

function publicCareersQuery(orgSlugPrefix: string): string {
  const q = new URLSearchParams({ org_slug: orgSlugPrefix });
  return `?${q.toString()}`;
}

export async function getPublicJobs(
  orgSlugPrefix: string,
  orgId: string,
): Promise<PublicJobsListResponse> {
  const data = await apiGet<PublicJobsListResponse>(
    `/orgs/${orgId}/jobs${publicCareersQuery(orgSlugPrefix)}`,
  );
  return { ...data, org_avatar_url: normalizeApiUrl(data.org_avatar_url) };
}

export async function getPublicJobDetail(
  orgId: string,
  jobId: string,
  orgSlugPrefix: string,
): Promise<PublicJobDetail> {
  const data = await apiGet<PublicJobDetail>(`/orgs/${orgId}/jobs/${jobId}${publicCareersQuery(orgSlugPrefix)}`);
  return { ...data, org_avatar_url: normalizeApiUrl(data.org_avatar_url) };
}

export async function applyToPublicJob(
  orgId: string,
  jobId: string,
  orgSlugPrefix: string,
  payload: PublicApplyPayload,
): Promise<PublicApplyResponse> {
  return apiFetch<PublicApplyResponse>(
    `/orgs/${orgId}/jobs/${jobId}/apply${publicCareersQuery(orgSlugPrefix)}`,
    {
      method: "POST",
      body: payload,
    },
  );
}
