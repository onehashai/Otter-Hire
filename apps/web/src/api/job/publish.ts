import { JobDetailResponse } from "./types";
import { apiFetch } from "../client/client";

export function publishJob(id: string): Promise<JobDetailResponse> {
    return apiFetch<JobDetailResponse>(`/jobs/${id}/publish`, {
      method: "POST",
    });
  }