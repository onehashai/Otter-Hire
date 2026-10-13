function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatCandidateSource(source: string | null | undefined): string {
  const value = source?.trim();
  if (!value) return "-";

  const normalized = value.toLowerCase();
  if (normalized === "email" || normalized === "email_automation") return "Email";
  if (normalized === "manual") return "Manual";
  if (normalized === "job_portal") return "Job portal";
  if (normalized === "linkedin_apply") return "LinkedIn application";
  if (normalized.startsWith("migration:")) {
    const provider = value.slice(value.indexOf(":") + 1);
    const providerKey = provider.toLowerCase().replace(/[_\s-]+/g, "");
    return providerKey === "bamboohr" ? "BambooHR" : titleCase(provider);
  }
  return titleCase(value);
}

const EMAIL_DOMAIN_NAMES: Record<string, string> = {
  "gmail.com": "Gmail",
  "googlemail.com": "Gmail",
  "outlook.com": "Outlook",
  "hotmail.com": "Outlook",
  "live.com": "Outlook",
  "yahoo.com": "Yahoo",
  "ymail.com": "Yahoo",
  "zoho.com": "Zoho",
  "zohomail.com": "Zoho",
  "icloud.com": "iCloud",
  "me.com": "iCloud",
};

export function formatEmailDomain(domain: string): string {
  const normalized = domain.trim().toLowerCase();
  return EMAIL_DOMAIN_NAMES[normalized] ?? normalized;
}
