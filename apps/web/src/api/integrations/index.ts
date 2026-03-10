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

export type OrgSmtpConfigResponse = {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string; // always "••••••••" from server
  from_email: string;
  from_name: string | null;
  use_tls: boolean;
  use_ssl: boolean;
  status: "pending" | "verified" | "failed";
  last_test_at: string | null;
  last_test_error: string | null;
};

export type OrgSmtpConfigUpsertRequest = {
  host: string;
  port: number;
  username: string;
  password?: string | null;
  from_email: string;
  from_name?: string | null;
  use_tls: boolean;
  use_ssl: boolean;
};

export function getSmtpConfig(): Promise<OrgSmtpConfigResponse | null> {
  return apiFetch<OrgSmtpConfigResponse | null>("/integrations/email/smtp/config", {
    method: "GET",
  });
}

export function upsertSmtpConfig(
  data: OrgSmtpConfigUpsertRequest,
): Promise<OrgSmtpConfigResponse> {
  return apiFetch<OrgSmtpConfigResponse>("/integrations/email/smtp/config", {
    method: "PUT",
    body: data,
  });
}

export function testSmtpConnection(): Promise<OrgSmtpConfigResponse> {
  return apiFetch<OrgSmtpConfigResponse>("/integrations/email/smtp/test", {
    method: "POST",
  });
}

export function deleteSmtpConfig(): Promise<void> {
  return apiFetch<void>("/integrations/email/smtp/config", { method: "DELETE" });
}
