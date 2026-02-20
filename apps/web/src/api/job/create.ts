import { apiFetch } from "../client/client";
import { JobDetailResponse } from "./types";

export function createJob(title: string): Promise<JobDetailResponse> {
    return apiFetch<JobDetailResponse>("/jobs", {
      method: "POST",
      body: { title },
    });
  }