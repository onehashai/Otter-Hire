import { JobDetailResponse } from "./types";
import { apiFetch } from "../client/client";

export function archiveJob(id: string): Promise<JobDetailResponse> {
    return apiFetch<JobDetailResponse>(`/jobs/${id}/archive`, {
      method: "POST",
    });
  }