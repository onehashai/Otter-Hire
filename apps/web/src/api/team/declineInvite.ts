import { API_BASE_URL, parseErrorResponse } from "../client/client";

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
