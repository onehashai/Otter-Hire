import { ApiError, apiFetch, apiGet, API_BASE_URL } from "../client/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CandidateSnippet = {
  id: string;
  name: string;
  email: string;
};

export type ConversationStatus = "open" | "closed" | "archived";

export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "received";

export type MessageAttachment = {
  s3_key: string;
  filename: string;
  mime_type: string;
  size: number;
};

export type MessageRead = {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  sender_type: "user" | "candidate";
  sender_user_id: string | null;
  sender_name: string | null;
  from_email: string;
  to_email: string;
  body: string;
  body_visible: string | null;
  body_quoted: string | null;
  html_body: string | null;
  status: MessageStatus;
  provider_message_id: string | null;
  created_at: string;
  attachments?: MessageAttachment[];
};

export type ConversationDetail = {
  id: string;
  subject: string;
  channel: string;
  status: ConversationStatus;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  candidate: CandidateSnippet;
  job_id: string | null;
  messages: MessageRead[];
};

export type ConversationCreateRequest = {
  candidate_id: string;
  job_id?: string | null;
  subject: string;
  body: string;
  html_body?: string | null;
  attachments?: MessageAttachment[];
};

export type MessageCreateRequest = {
  body: string;
  html_body?: string | null;
  attachments?: MessageAttachment[];
};

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export function getConversation(conversationId: string): Promise<ConversationDetail> {
  return apiFetch<ConversationDetail>(`/conversations/${conversationId}`, { method: "GET" });
}

/** Single thread for this candidate, or `null` if none (404 from API). */
export async function getConversationByCandidateId(
  candidateId: string,
): Promise<ConversationDetail | null> {
  try {
    return await apiGet<ConversationDetail>(
      `/conversations/by-candidate/${encodeURIComponent(candidateId)}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function createConversation(data: ConversationCreateRequest): Promise<ConversationDetail> {
  return apiFetch<ConversationDetail>("/conversations", { method: "POST", body: data });
}

export function sendMessage(
  conversationId: string,
  data: MessageCreateRequest,
): Promise<MessageRead> {
  return apiFetch<MessageRead>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: data,
  });
}

export async function uploadTempAttachment(
  candidateId: string,
  file: File,
): Promise<MessageAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${API_BASE_URL}/candidates/${encodeURIComponent(candidateId)}/documents/upload-temp`,
    { method: "POST", credentials: "include", body: form },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `Upload failed: ${res.status}`);
  }
  return res.json() as Promise<MessageAttachment>;
}
