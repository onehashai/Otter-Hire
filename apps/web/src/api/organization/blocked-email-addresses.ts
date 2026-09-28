import { apiDelete, apiGet, apiPost } from "../client/client";

export type BlockedEmailAddressResponse = {
  id: string;
  email: string;
  created_at: string;
  created_by_user_id: string | null;
};

export async function getBlockedEmailAddresses(): Promise<BlockedEmailAddressResponse[]> {
  return apiGet<BlockedEmailAddressResponse[]>("/organizations/blocked-email-addresses");
}

export async function createBlockedEmailAddresses(
  emails: string[],
): Promise<BlockedEmailAddressResponse[]> {
  return apiPost<BlockedEmailAddressResponse[]>("/organizations/blocked-email-addresses", {
    emails,
  });
}

export async function deleteBlockedEmailAddress(id: string): Promise<void> {
  return apiDelete(`/organizations/blocked-email-addresses/${id}`);
}
