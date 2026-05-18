import { apiGet } from "../client/client";

export type EmailLogRow = {
  id: string;
  received_at: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  parse_status: "ignored" | "processed" | "failed";
  parse_error: string | null;
  has_resume_attachment: boolean;
  attachment_count: number;
  attachment_primary_filename: string | null;
  parsed_candidate_id: string | null;
  parse_duration_ms: number | null;
  inbox_address: string;
  created_at: string;
};

export type AdminEmailLogRow = EmailLogRow & {
  org_id: string;
  org_name: string;
};

export type EmailLogFilters = {
  status?: string;
  sender?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

function toQS(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function getOrgEmailLogs(filters: EmailLogFilters = {}): Promise<EmailLogRow[]> {
  return apiGet<EmailLogRow[]>(
    `/organizations/email-logs${toQS(filters as Record<string, string | number | undefined>)}`,
  );
}

export function getAdminEmailLogs(
  orgId?: string,
  filters: EmailLogFilters = {},
): Promise<AdminEmailLogRow[]> {
  return apiGet<AdminEmailLogRow[]>(
    `/admin/email-logs${toQS({ org_id: orgId, ...(filters as Record<string, string | number | undefined>) })}`,
  );
}
