import { JobDetailResponse } from "./types";
import { apiFetch } from "../client/client";

export function closeJob(id: string): Promise<JobDetailResponse> {
    return apiFetch<JobDetailResponse>(`/jobs/${id}/close`, {
      method: "POST",
    });
  }