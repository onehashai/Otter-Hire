import { API_BASE_URL, parseErrorResponse } from "../client/client";

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
  