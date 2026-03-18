import { API_BASE_URL, apiFetch, normalizeApiUrl } from "../client/client";

export type CandidateListItemResponse = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  profile_links: Record<string, string>;
  source: string | null;
  tags: string[];
  status: "active" | "rejected" | "hired";
  job_id: string | null;
  job_title: string | null;
  stage_id: string | null;
  stage_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CandidateDetailResponse = CandidateListItemResponse & {};

export type CandidatesPaginatedResponse = {
  items: CandidateListItemResponse[];
  total: number;
  limit: number;
  offset: number;
};

export type CandidateBulkUpdateResponse = {
  updated_count: number;
};

export type CreateCandidatePayload = {
  job_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  profile_links?: Record<string, string>;
  stage_id?: string | null;
  source?: string | null;
  tags?: string[];
  status?: "active" | "rejected" | "hired";
};

export type CandidateOverviewResponse = {
  notes: Array<{
    id: string;
    author_user_id: string;
    author_name: string | null;
    content: string;
    mentions: Array<{
      user_id: string;
      name: string | null;
      email: string;
    }>;
    created_at: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    metadata: Record<string, unknown>;
    created_by_user_id: string;
    created_by_name: string | null;
    created_at: string;
  }>;
};

export type CandidateInterviewResponse = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number | null;
  meeting_link: string | null;
  interviewer_ids: string[];
  created_at: string;
  updated_at: string;
};

export type CandidateFeedbackResponse = {
  id: string;
  interview_id: string;
  reviewer_user_id: string;
  reviewer_name: string | null;
  rating: number | null;
  decision: "yes" | "no" | "maybe";
  comments: string | null;
  created_at: string;
};

export type CandidateEvaluationResponse = {
  average_rating: number;
  counts: Record<string, number>;
  feedback: CandidateFeedbackResponse[];
};

export type CandidateDocumentResponse = {
  id: string;
  field_key: string;
  name: string;
  url: string;
  object_key: string;
  mime_type: string;
  size_bytes: number;
  doc_type: string;
  size_label: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_at: string;
};

export async function getCandidates(params?: {
  search?: string;
  job_id?: string;
  stage_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<CandidateListItemResponse[]> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.job_id) searchParams.set("job_id", params.job_id);
  if (params?.stage_id) searchParams.set("stage_id", params.stage_id);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString();
  return apiFetch<CandidateListItemResponse[]>(`/candidates${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

export async function getCandidateById(id: string): Promise<CandidateDetailResponse> {
  return apiFetch<CandidateDetailResponse>(`/candidates/${id}`, { method: "GET" });
}

export async function updateCandidate(
  id: string,
  payload: {
    name?: string;
    email?: string;
    phone?: string | null;
    location?: string | null;
    profile_links?: Record<string, string>;
    job_id?: string | null;
    clear_job?: boolean;
  },
): Promise<CandidateDetailResponse> {
  return apiFetch<CandidateDetailResponse>(`/candidates/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function getCandidatesPaginated(params?: {
  search?: string;
  job_id?: string;
  stage_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<CandidatesPaginatedResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.job_id) searchParams.set("job_id", params.job_id);
  if (params?.stage_id) searchParams.set("stage_id", params.stage_id);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString();
  return apiFetch<CandidatesPaginatedResponse>(`/candidates/paginated${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

export async function updateCandidateStage(
  id: string,
  stageId: string,
): Promise<CandidateDetailResponse> {
  return apiFetch<CandidateDetailResponse>(`/candidates/${id}/stage`, {
    method: "PATCH",
    body: { stage_id: stageId },
  });
}

export async function bulkUpdateCandidateStatus(
  candidateIds: string[],
  status: "active" | "rejected" | "hired",
): Promise<CandidateBulkUpdateResponse> {
  return apiFetch<CandidateBulkUpdateResponse>("/candidates/actions/bulk/status", {
    method: "PATCH",
    body: { candidate_ids: candidateIds, status },
  });
}

export async function bulkUpdateCandidateStage(
  candidateIds: string[],
  stageId: string,
): Promise<CandidateBulkUpdateResponse> {
  return apiFetch<CandidateBulkUpdateResponse>("/candidates/actions/bulk/stage", {
    method: "PATCH",
    body: { candidate_ids: candidateIds, stage_id: stageId },
  });
}

export async function createCandidate(
  payload: CreateCandidatePayload,
): Promise<CandidateDetailResponse> {
  return apiFetch<CandidateDetailResponse>("/candidates", {
    method: "POST",
    body: payload,
  });
}

export async function getCandidateOverview(id: string): Promise<CandidateOverviewResponse> {
  return apiFetch<CandidateOverviewResponse>(`/candidates/${id}/overview`, { method: "GET" });
}

export async function addCandidateNote(
  id: string,
  payload: { content: string; mentions?: string[] },
): Promise<void> {
  await apiFetch(`/candidates/${id}/notes`, {
    method: "POST",
    body: {
      content: payload.content,
      mentions: payload.mentions ?? [],
    },
  });
}

export async function getCandidateInterviews(id: string): Promise<CandidateInterviewResponse[]> {
  return apiFetch<CandidateInterviewResponse[]>(`/candidates/${id}/interviews`, { method: "GET" });
}

export async function createCandidateInterview(
  id: string,
  payload: {
    title: string;
    scheduled_at: string;
    duration_minutes?: number | null;
    meeting_link?: string | null;
    interviewer_ids?: string[];
  },
): Promise<CandidateInterviewResponse> {
  return apiFetch<CandidateInterviewResponse>(`/candidates/${id}/interviews`, {
    method: "POST",
    body: payload,
  });
}

export async function createCandidateFeedback(
  candidateId: string,
  interviewId: string,
  payload: {
    rating?: number | null;
    decision: "yes" | "no" | "maybe";
    comments?: string | null;
  },
): Promise<CandidateFeedbackResponse> {
  return apiFetch<CandidateFeedbackResponse>(
    `/candidates/${candidateId}/interviews/${interviewId}/feedback`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function getCandidateEvaluation(id: string): Promise<CandidateEvaluationResponse> {
  return apiFetch<CandidateEvaluationResponse>(`/candidates/${id}/evaluation`, { method: "GET" });
}

export async function getCandidateDocuments(id: string): Promise<CandidateDocumentResponse[]> {
  const docs = await apiFetch<CandidateDocumentResponse[]>(`/candidates/${id}/documents`, {
    method: "GET",
  });
  return docs.map((doc) => ({ ...doc, url: normalizeApiUrl(doc.url) ?? doc.url }));
}

export async function uploadCandidateDocument(
  id: string,
  file: File,
  docType = "custom_field_attachment",
  fieldKey = "attachment",
  fieldLabel?: string,
): Promise<CandidateDocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doc_type", docType);
  formData.append("field_key", fieldKey);
  if (fieldLabel) formData.append("field_label", fieldLabel);

  const res = await fetch(`${API_BASE_URL}/candidates/${id}/documents/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { detail?: string; error?: string };
      const msg =
        typeof data.detail === "string"
          ? data.detail
          : typeof data.error === "string"
            ? data.error
            : "";
      if (msg.trim()) message = msg;
    } catch {}
    throw new Error(message);
  }

  const doc = (await res.json()) as CandidateDocumentResponse;
  return { ...doc, url: normalizeApiUrl(doc.url) ?? doc.url };
}

export async function deleteCandidateDocument(
  candidateId: string,
  documentId: string,
): Promise<void> {
  await apiFetch<void>(`/candidates/${candidateId}/documents/${documentId}`, {
    method: "DELETE",
  });
}
