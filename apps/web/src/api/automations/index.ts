import { apiFetch } from "../client/client";

export type AutomationListItemResponse = {
  id: string;
  name: string;
  status: string;
  scope: string;
  trigger_type: string;
  trigger_label: string;
  action_label: string;
  last_run_at: string | null;
  execution_count: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationCondition = {
  field: string;
  operator: string;
  value: string;
};

export type AutomationAction = {
  type: string;
  config: Record<string, string>;
};

export type AutomationDetailResponse = {
  id: string;
  name: string;
  status: string;
  scope: string;
  job_id: string | null;
  trigger_type: string;
  trigger_key: string;
  trigger_config: Record<string, unknown>;
  condition_logic: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  description: string | null;
  last_run_at: string | null;
  execution_count: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationCreatePayload = {
  name: string;
  status?: string;
  scope?: string;
  job_id?: string | null;
  trigger_type: string;
  trigger_key: string;
  trigger_config?: Record<string, unknown>;
  condition_logic?: string;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
  description?: string | null;
};

export type AutomationUpdatePayload = Partial<AutomationCreatePayload>;

export type AutomationExecutionLogEntry = {
  id: string;
  trigger_event: string;
  candidate_id: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  job_id: string | null;
  status: string;
  message: string | null;
  created_at: string;
};

export function getAutomations(): Promise<AutomationListItemResponse[]> {
  return apiFetch<AutomationListItemResponse[]>("/automations", { method: "GET" });
}

export function getAutomationById(id: string): Promise<AutomationDetailResponse> {
  return apiFetch<AutomationDetailResponse>(`/automations/${id}`, { method: "GET" });
}

export function createAutomation(
  payload: AutomationCreatePayload,
): Promise<AutomationDetailResponse> {
  return apiFetch<AutomationDetailResponse>("/automations", {
    method: "POST",
    body: payload,
  });
}

export function updateAutomation(
  id: string,
  payload: AutomationUpdatePayload,
): Promise<AutomationDetailResponse> {
  return apiFetch<AutomationDetailResponse>(`/automations/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteAutomation(id: string): Promise<void> {
  return apiFetch<void>(`/automations/${id}`, { method: "DELETE" });
}

export function getAutomationExecutions(id: string): Promise<AutomationExecutionLogEntry[]> {
  return apiFetch<AutomationExecutionLogEntry[]>(`/automations/${id}/executions`, {
    method: "GET",
  });
}
