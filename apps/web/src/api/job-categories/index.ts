import { apiGet, apiPost, apiDelete } from "../client/client";

export type JobCategoryResponse = {
  id: string;
  name: string;
  is_system_default: boolean;
  created_at: string;
};

export type JobCategoryCreateRequest = {
  name: string;
};

export async function getJobCategories(): Promise<JobCategoryResponse[]> {
  return apiGet<JobCategoryResponse[]>("/organizations/categories");
}

export async function createJobCategory(data: JobCategoryCreateRequest): Promise<JobCategoryResponse> {
  return apiPost<JobCategoryResponse>("/organizations/categories", data);
}

export async function deleteJobCategory(id: string): Promise<void> {
  return apiDelete(`/organizations/categories/${id}`);
}
