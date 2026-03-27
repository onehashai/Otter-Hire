import { JobDetailResponse } from "./types";
import { apiFetch } from "../client/client";

export function unarchiveJob(id: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}/unarchive`, {
    method: "POST",
  });
}
