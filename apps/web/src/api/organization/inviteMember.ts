import { OrgUserResponse } from "../auth/auth";
import { apiFetch } from "../client/client";

export function inviteOrgUser(email: string): Promise<OrgUserResponse> {
return apiFetch<OrgUserResponse>("/users/invite", {
    method: "POST",
    body: { email },
});
}
