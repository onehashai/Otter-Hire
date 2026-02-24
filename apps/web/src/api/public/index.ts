import { apiGet } from "../client/client";

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
  status: string;
};

export async function getPublicJobs(orgId: string): Promise<PublicJobListItem[]> {
  return apiGet<PublicJobListItem[]>(`/public/orgs/${orgId}/jobs`);
}

export async function getPublicJobDetail(orgId: string, jobId: string): Promise<PublicJobDetail> {
  return apiGet<PublicJobDetail>(`/public/orgs/${orgId}/jobs/${jobId}`);
}
