import { apiFetch } from "../client/client";

export type JobDescriptionAiAction =
  | "generate_full"
  | "improve_tone"
  | "shorten"
  | "expand"
  | "add_responsibilities"
  | "add_requirements";

export type JobDescriptionAiRequest = {
  action: JobDescriptionAiAction;
  current_html: string;
};

export type JobDescriptionAiResponse = {
  html: string;
};

export function aiJobDescription(
  jobId: string,
  body: JobDescriptionAiRequest,
): Promise<JobDescriptionAiResponse> {
  return apiFetch<JobDescriptionAiResponse>(`/jobs/${jobId}/ai-description`, {
    method: "POST",
    body,
  });
}
