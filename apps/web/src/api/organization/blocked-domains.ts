import { apiDelete, apiGet, apiPost } from "../client/client";

export type BlockedDomainResponse = {
  id: string;
  domain: string;
  created_at: string;
  created_by_user_id: string | null;
};

export async function getBlockedDomains(): Promise<BlockedDomainResponse[]> {
  return apiGet<BlockedDomainResponse[]>("/organizations/blocked-domains");
}

export async function createBlockedDomains(domains: string[]): Promise<BlockedDomainResponse[]> {
  return apiPost<BlockedDomainResponse[]>("/organizations/blocked-domains", { domains });
}

export async function deleteBlockedDomain(id: string): Promise<void> {
  return apiDelete(`/organizations/blocked-domains/${id}`);
}
