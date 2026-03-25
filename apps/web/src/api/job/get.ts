import { apiFetch } from "../client/client";
import { JobListItemResponse, JobDetailResponse, JobWorkspaceResponse } from "./types";

export function getJobs(): Promise<JobListItemResponse[]> {
  return apiFetch<JobListItemResponse[]>("/jobs", { method: "GET" });
}

export function getJobById(id: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}`, { method: "GET" });
}

export function getJobWorkspace(id: string): Promise<JobWorkspaceResponse> {
  return apiFetch<JobWorkspaceResponse>(`/jobs/${id}/workspace`, { method: "GET" });
}
