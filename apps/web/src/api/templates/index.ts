import { apiFetch } from "../client/client";

export type TemplateResponse = {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type TemplateCreatePayload = {
  name: string;
  category?: string;
  subject: string;
  body?: string;
};

export type TemplateUpdatePayload = {
  name?: string;
  category?: string;
  subject?: string;
  body?: string;
};

export function getTemplates(): Promise<TemplateResponse[]> {
  return apiFetch<TemplateResponse[]>("/templates", { method: "GET" });
}

export function getTemplateById(id: string): Promise<TemplateResponse> {
  return apiFetch<TemplateResponse>(`/templates/${id}`, { method: "GET" });
}

export function createTemplate(payload: TemplateCreatePayload): Promise<TemplateResponse> {
  return apiFetch<TemplateResponse>("/templates", {
    method: "POST",
    body: {
      name: payload.name,
      category: payload.category ?? "Email",
      subject: payload.subject,
      body: payload.body ?? "",
    },
  });
}

export function updateTemplate(
  id: string,
  payload: TemplateUpdatePayload,
): Promise<TemplateResponse> {
  return apiFetch<TemplateResponse>(`/templates/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteTemplate(id: string): Promise<void> {
  return apiFetch<void>(`/templates/${id}`, { method: "DELETE" });
}

export function getTemplateUsages(
  id: string,
): Promise<{ automations: { id: string; name: string }[] }> {
  return apiFetch(`/templates/${id}/usages`, { method: "GET" });
}
