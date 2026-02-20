import { apiFetch } from "../client/client";
import { InviteDetailsResponse } from "../auth/auth";

export function getInviteDetails(token: string): Promise<InviteDetailsResponse> {
  return apiFetch<InviteDetailsResponse>(`/auth/invite/${token}`, { method: "GET" });
}

export function acceptInvite(token: string): Promise<void> {
  return apiFetch<void>(`/auth/invite/${token}/accept`, { method: "POST" });
}

export function declineInvite(token: string): Promise<void> {
  return apiFetch<void>(`/auth/invite/${token}/decline`, { method: "POST" });
}
