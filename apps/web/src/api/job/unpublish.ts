import { JobDetailResponse } from "./types";
import { apiFetch } from "../client/client";

export function unpublishJob(id: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}/unpublish`, {
    method: "POST",
  });
}
