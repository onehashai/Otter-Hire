import { API_BASE_URL, parseErrorResponse } from "../client/client";
import type { AuthSessionResponse } from "../auth/auth";

export type InviteDetailsResponse = {
  org_name: string;
  role: string;
  inviter_email?: string;
  expires_at?: string;
};

export async function getInviteDetails(token: string): Promise<InviteDetailsResponse> {
  const res = await fetch(`${API_BASE_URL}/invites/${token}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await parseErrorResponse(
      res,
      "This invite link is invalid or has expired."
    );
    throw new Error(message);
  }

  return (await res.json()) as InviteDetailsResponse;
}

export async function acceptInvite(token: string): Promise<AuthSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/invites/${token}/accept`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    const message = await parseErrorResponse(res, "Failed to accept invite.");
    throw new Error(message);
  }

  return (await res.json()) as AuthSessionResponse;
}

export async function declineInvite(token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/invites/${token}/decline`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok && res.status !== 204) {
    const message = await parseErrorResponse(res, "Failed to decline invite.");
    throw new Error(message);
  }
}
