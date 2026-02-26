import { apiFetch } from "../client/client";
import { JobListItemResponse, JobDetailResponse, JobPipelineResponse } from "./types";

export function getJobs(): Promise<JobListItemResponse[]> {
  return apiFetch<JobListItemResponse[]>("/jobs", { method: "GET" });
}

export function getJobById(id: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}`, { method: "GET" });
}

export function getJobPipeline(id: string): Promise<JobPipelineResponse> {
  return apiFetch<JobPipelineResponse>(`/jobs/${id}/pipeline`, { method: "GET" });
}
