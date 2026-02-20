import { API_BASE_URL, parseErrorResponse } from "../client/client";
import type { AuthSessionResponse } from "../auth/auth";

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