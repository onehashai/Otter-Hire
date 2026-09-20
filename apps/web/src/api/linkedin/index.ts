import { apiDelete, apiGet, apiPost } from "../client/client";

export interface LinkedInStatus {
  connected: boolean;
  status: string;
  oauth_configured?: boolean;
  distribution_enabled?: boolean;
  lead_sync_enabled?: boolean;
  can_post?: boolean;
  can_sync_leads?: boolean;
  lead_sync_last_error?: string | null;
  lead_subscription?: { id: string; status: string; owner: Record<string, string> } | null;
  setup_complete?: boolean;
  setup_incomplete?: boolean;
  profile?: {
    name?: string;
    email?: string;
    picture?: string;
  };
  organization?: {
    id?: string;
    name?: string;
    vanity_name?: string;
    logo_url?: string;
  } | null;
  connected_at?: string;
}

export interface LinkedInOrganization {
  id: string;
  name: string;
  vanity_name: string;
  logo_url?: string | null;
}

export interface LinkedInOrganizationsResponse {
  organizations: LinkedInOrganization[];
}

export interface LinkedInConnectResponse {
  authorization_url: string;
  state: string;
  callback_origin: string;
}

export interface LinkedInCompleteSetupRequest {
  organization_id: string;
  organization_name: string;
  organization_vanity_name: string;
  organization_logo_url?: string | null;
}

export async function getLinkedInStatus(): Promise<LinkedInStatus> {
  return apiGet<LinkedInStatus>("/integrations/linkedin/status");
}

export async function connectLinkedIn(leadSync = false): Promise<LinkedInConnectResponse> {
  return apiGet<LinkedInConnectResponse>(`/integrations/linkedin/connect?lead_sync=${leadSync}`);
}

export async function subscribeLinkedInLeads(accountId?: string): Promise<void> {
  await apiPost("/integrations/linkedin/lead-subscription", {
    sponsored_account_id: accountId || null,
  });
}

export async function unsubscribeLinkedInLeads(): Promise<void> {
  await apiDelete("/integrations/linkedin/lead-subscription");
}

export async function getLinkedInOrganizations(): Promise<LinkedInOrganizationsResponse> {
  return apiGet<LinkedInOrganizationsResponse>("/integrations/linkedin/organizations");
}

export async function completeLinkedInSetup(
  data: LinkedInCompleteSetupRequest,
): Promise<{ message: string }> {
  return apiPost("/integrations/linkedin/complete-setup", data);
}

export async function disconnectLinkedIn(): Promise<void> {
  await apiPost("/integrations/linkedin/disconnect", {});
}
