import { apiFetch } from "../client/client";
import { InviteDetailsResponse } from "../auth/auth";

export function getInviteDetails(token: string): Promise<InviteDetailsResponse> {
  return apiFetch<InviteDetailsResponse>(`/auth/invite/${token}`, { method: "GET" });
}

export type AcceptInvitePayload = {
  token: string;
  name?: string;
  password: string;
};

export function acceptInvite(payload: AcceptInvitePayload): Promise<void> {
  return apiFetch<void>("/auth/accept-invite", {
    method: "POST",
    body: payload,
  });
}

export function declineInvite(token: string): Promise<void> {
  return apiFetch<void>(`/auth/invite/${token}/decline`, { method: "POST" });
}

export function acceptExistingInvite(token: string): Promise<void> {
  return apiFetch<void>(`/auth/invite/${token}/accept-existing`, { method: "POST" });
}
