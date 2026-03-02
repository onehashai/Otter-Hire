import { apiFetch } from "../client/client";
import type { OrganizationResponse } from "./update";

export function getMyOrganization(): Promise<OrganizationResponse> {
  return apiFetch<OrganizationResponse>("/organizations/me", {
    method: "GET",
  });
}

export type OrgInboxResponse = {
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

export type OrgInboxActionResponse = {
  status: string;
  message: string;
  action_url?: string | null;
};

export function getMyOrgInbox(): Promise<OrgInboxResponse | null> {
  return apiFetch<OrgInboxResponse | null>("/organizations/me/inbox", {
    method: "GET",
  });
}

export function upsertMyOrgInbox(data: {
  inbox_address: string;
  provider: string;
}): Promise<OrgInboxResponse> {
  return apiFetch<OrgInboxResponse>("/organizations/me/inbox", {
    method: "POST",
    body: data,
  });
}

export function rotateMyOrgInboxSecret(): Promise<OrgInboxActionResponse> {
  return apiFetch<OrgInboxActionResponse>("/organizations/me/inbox/rotate-secret", {
    method: "POST",
  });
}

export function activateMyOrgInbox(): Promise<OrgInboxActionResponse> {
  return apiFetch<OrgInboxActionResponse>("/organizations/me/inbox/activate", {
    method: "POST",
  });
}

export function verifyNowMyOrgInbox(): Promise<OrgInboxActionResponse> {
  return apiFetch<OrgInboxActionResponse>("/organizations/me/inbox/verify-now", {
    method: "POST",
  });
}

export function verifyCompleteMyOrgInbox(): Promise<OrgInboxActionResponse> {
  return apiFetch<OrgInboxActionResponse>("/organizations/me/inbox/verify-complete", {
    method: "POST",
  });
}
