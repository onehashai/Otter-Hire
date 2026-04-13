import { apiFetch } from "../client/client";

export type IntegrationAppDescriptor = {
  app_id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  status: string;
  installed: boolean;
};

export type IntegrationInstalledApp = {
  app_id: string;
  slug: string;
  name: string;
  status: string;
  installed_at: string | null;
  configured: boolean;
};

export type IntegrationAppsResponse = {
  items: IntegrationAppDescriptor[];
};

export type IntegrationInstalledAppsResponse = {
  items: IntegrationInstalledApp[];
};

export type IntegrationEmailConfigResponse = {
  app_id: "email_integration";
  inbox: IntegrationOrgInboxResponse | null;
  configured: boolean;
  status: string;
};

export type IntegrationEmailConfigUpsertRequest = {
  inbox_address: string;
  provider: string;
};

export type IntegrationEmailConfigActionResponse = IntegrationInboxActionResponse & {
  app_id: "email_integration";
};

export function getIntegrationApps(): Promise<IntegrationAppsResponse> {
  return apiFetch<IntegrationAppsResponse>("/integrations/apps", { method: "GET" });
}

export function getInstalledIntegrationApps(): Promise<IntegrationInstalledAppsResponse> {
  return apiFetch<IntegrationInstalledAppsResponse>("/integrations/installed", { method: "GET" });
}

export function getEmailIntegrationConfig(): Promise<IntegrationEmailConfigResponse> {
  return apiFetch<IntegrationEmailConfigResponse>("/integrations/email/config", { method: "GET" });
}

export function upsertEmailIntegrationConfig(
  data: IntegrationEmailConfigUpsertRequest,
): Promise<IntegrationEmailConfigResponse> {
  return apiFetch<IntegrationEmailConfigResponse>("/integrations/email/config", {
    method: "PUT",
    body: data,
  });
}

export function rotateEmailIntegrationSecret(): Promise<IntegrationEmailConfigActionResponse> {
  return apiFetch<IntegrationEmailConfigActionResponse>("/integrations/email/rotate-secret", {
    method: "POST",
  });
}

export function activateEmailIntegration(): Promise<IntegrationEmailConfigActionResponse> {
  return apiFetch<IntegrationEmailConfigActionResponse>("/integrations/email/activate", {
    method: "POST",
  });
}

export function verifyNowEmailIntegration(): Promise<IntegrationEmailConfigActionResponse> {
  return apiFetch<IntegrationEmailConfigActionResponse>("/integrations/email/verify-now", {
    method: "POST",
  });
}

export function verifyCompleteEmailIntegration(): Promise<IntegrationEmailConfigActionResponse> {
  return apiFetch<IntegrationEmailConfigActionResponse>("/integrations/email/verify-complete", {
    method: "POST",
  });
}

export function disconnectEmailIntegration(): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>("/integrations/email/disconnect", {
    method: "POST",
  });
}
export type IntegrationOrgInboxResponse = {
  id: string;
  org_id: string;
  inbox_address: string;
  provider: string;
  status: "inactive" | "pending" | "active";
  verification_status: "pending" | "action_required" | "verified" | "failed";
  verification_provider: string | null;
  verification_action_type: string | null;
  verification_action_url: string | null;
  verification_detected_at: string | null;
  verification_error: string | null;
  verified_at: string | null;
  verification_expires_at: string | null;
};

export type IntegrationInboxActionResponse = {
  status: string;
  message: string;
  action_url?: string | null;
};

export type JobIntegrationEmailConfigResponse = {
  app_id: "email_integration";
  inbox: JobIntegrationInboxResponse | null;
  configured: boolean;
  status: string;
};

export type JobIntegrationEmailConfigUpsertRequest = {
  inbox_address: string;
  provider: string;
};

export type JobIntegrationInboxResponse = {
  job_id: string;
  org_id: string;
  inbox_address: string;
  provider: string;
  status: "inactive" | "pending" | "active";
  verification_status: "pending" | "action_required" | "verified" | "failed";
  verification_provider: string | null;
  verification_action_type: string | null;
  verification_action_url: string | null;
  verification_detected_at: string | null;
  verification_error: string | null;
  verified_at: string | null;
  verification_expires_at: string | null;
};

export type JobIntegrationEmailActionResponse = {
  app_id: "email_integration";
  status: string;
  message: string;
  action_url?: string | null;
};

export function getJobEmailIntegrationConfig(
  jobId: string,
): Promise<JobIntegrationEmailConfigResponse> {
  return apiFetch<JobIntegrationEmailConfigResponse>(`/jobs/${jobId}/integrations/email/config`, {
    method: "GET",
  });
}

export function upsertJobEmailIntegrationConfig(
  jobId: string,
  data: JobIntegrationEmailConfigUpsertRequest,
): Promise<JobIntegrationEmailConfigResponse> {
  return apiFetch<JobIntegrationEmailConfigResponse>(`/jobs/${jobId}/integrations/email/config`, {
    method: "PUT",
    body: data,
  });
}

export function rotateJobEmailIntegrationSecret(
  jobId: string,
): Promise<JobIntegrationEmailActionResponse> {
  return apiFetch<JobIntegrationEmailActionResponse>(
    `/jobs/${jobId}/integrations/email/rotate-secret`,
    {
      method: "POST",
    },
  );
}

export function verifyNowJobEmailIntegration(
  jobId: string,
): Promise<JobIntegrationEmailActionResponse> {
  return apiFetch<JobIntegrationEmailActionResponse>(
    `/jobs/${jobId}/integrations/email/verify-now`,
    {
      method: "POST",
    },
  );
}

export function verifyCompleteJobEmailIntegration(
  jobId: string,
): Promise<JobIntegrationEmailActionResponse> {
  return apiFetch<JobIntegrationEmailActionResponse>(
    `/jobs/${jobId}/integrations/email/verify-complete`,
    {
      method: "POST",
    },
  );
}

export function disconnectJobEmailIntegration(
  jobId: string,
): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(
    `/jobs/${jobId}/integrations/email/disconnect`,
    {
      method: "POST",
    },
  );
}
