import { apiFetch, apiGet, normalizeApiUrl } from "../client/client";

export type AdminUserMembershipRow = {
  membership_id: string;
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  product_role: string;
  organization_role: string;
  org_id: string;
  org_name: string;
  status: string;
  last_active_at: string | null;
};

export type AdminOrganizationRow = {
  id: string;
  name: string;
  website: string | null;
  member_count: number;
  created_at: string;
};

export async function getAdminUserMemberships(): Promise<AdminUserMembershipRow[]> {
  const rows = await apiGet<AdminUserMembershipRow[]>("/admin/users");
  return rows.map((r) => ({
    ...r,
    avatar_url: normalizeApiUrl(r.avatar_url),
  }));
}

export async function getAdminOrganizations(): Promise<AdminOrganizationRow[]> {
  return apiGet<AdminOrganizationRow[]>("/admin/organizations");
}

export type AdminUpdateMembershipPatch = {
  name?: string;
  email?: string;
  product_role?: "user" | "admin";
  organization_role?: string;
  status?: "invited" | "active" | "disabled";
};

export async function patchAdminMembership(
  membershipId: string,
  body: AdminUpdateMembershipPatch,
): Promise<AdminUserMembershipRow> {
  const row = await apiFetch<AdminUserMembershipRow>(`/admin/memberships/${membershipId}`, {
    method: "PATCH",
    body,
  });
  return { ...row, avatar_url: normalizeApiUrl(row.avatar_url) };
}
