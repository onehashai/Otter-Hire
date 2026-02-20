import { apiFetch } from "../client/client";
import { JobDetailResponse, JobUpdatePayload } from "./types";

export function updateJob(
    id: string,
    payload: JobUpdatePayload,
  ): Promise<JobDetailResponse> {
    return apiFetch<JobDetailResponse>(`/jobs/${id}`, {
      method: "PATCH",
      body: payload,
    });
  }
  