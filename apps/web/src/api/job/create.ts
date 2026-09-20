import { apiFetch } from "../client/client";
import { JobDetailResponse } from "./types";

export function createJob(title: string, postToLinkedin = false): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>("/jobs", {
    method: "POST",
    body: { title, post_to_linkedin: postToLinkedin },
  });
}
