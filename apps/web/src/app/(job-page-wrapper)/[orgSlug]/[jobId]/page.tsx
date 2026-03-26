"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Separator } from "@onehash/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@onehash/ui/dialog";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { Avatar } from "@onehash/ui/avatar";
import { Icon } from "@onehash/ui/icon";
import type { IconName } from "@onehash/ui/icon";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toast } from "@onehash/ui/sonner";
import { applyToPublicJob, getPublicJobDetail, type PublicJobDetail } from "@/api";
import { PLATFORM_NAME } from "@/lib/constants";
import { parseOrgSlug } from "@/lib/public-careers-org";

type ApplyFile = { name: string; size: number; type: string };

function formatSalary(job: PublicJobDetail): string | null {
  const currencySymbol =
    job.currency === "INR"
      ? "₹"
      : job.currency === "USD"
        ? "$"
        : job.currency === "EUR"
          ? "€"
          : job.currency;
  const timeframe = job.salary_timeframe.replace("per_", "");

  if (job.salary_fixed) {
    return `${currencySymbol}${job.salary_fixed.toLocaleString()} / ${timeframe}`;
  }
  if (job.salary_min && job.salary_max) {
    return `${currencySymbol}${job.salary_min.toLocaleString()} – ${currencySymbol}${job.salary_max.toLocaleString()} / ${timeframe}`;
  }
  return null;
}

function formatLocation(job: PublicJobDetail): string | null {
  if (job.city && job.country) return `${job.city}, ${job.country}`;
  if (job.city) return job.city;
  if (job.country) return job.country;
  return null;
}

function formatEmploymentType(type: string): string {
  return type.replace("_", "-").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function CareerJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const orgSlug = params?.orgSlug as string;
  const jobId = params?.jobId as string;

  const [job, setJob] = useState<PublicJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("");

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    answers: {} as Record<string, unknown>,
    files: {} as Record<string, ApplyFile | undefined>,
  });
  const [applySubmitting, setApplySubmitting] = useState(false);

  useEffect(() => {
    const parsed = parseOrgSlug(orgSlug);
    if (!parsed) {
      setError("Invalid organization");
      setLoading(false);
      return;
    }

    setOrgName(parsed.orgName);

    getPublicJobDetail(parsed.orgId, jobId, parsed.orgName)
      .then((data) => {
        setJob(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Job not found");
        setLoading(false);
      });
  }, [orgSlug, jobId]);

  const openApplyDialog = () => setApplyDialogOpen(true);
  const closeApplyDialog = () => {
    setApplyDialogOpen(false);
    setApplyForm({ fullName: "", email: "", phone: "", answers: {}, files: {} });
  };

  const applicationSchema = (job?.application_form_schema ?? {}) as Record<string, unknown>;
  const defaultFields = (applicationSchema.default_fields ?? {}) as Record<
    string,
    { visibility?: string; label?: string }
  >;
  const schemaProfileLinks = Array.isArray(applicationSchema.profile_links)
    ? (applicationSchema.profile_links as Array<Record<string, unknown>>)
    : [];
  const schemaCustomFields = Array.isArray(applicationSchema.custom_fields)
    ? (applicationSchema.custom_fields as Array<Record<string, unknown>>)
    : [];
  const profileLinkMap = new Map<string, Record<string, unknown>>();
  for (const linkField of schemaProfileLinks) {
    const key = String(linkField.key ?? linkField.id ?? "");
    if (key) profileLinkMap.set(key, linkField);
  }
  const customFields: Array<Record<string, unknown>> = [];
  for (const field of schemaCustomFields) {
    const key = String(field.key ?? field.id ?? "");
    if (key.startsWith("profile_link_")) {
      profileLinkMap.set(key, field);
      continue;
    }
    customFields.push(field);
  }
  const profileLinkFields = Array.from(profileLinkMap.values());

  const fieldVisibility = (key: string, fallback: "required" | "optional" | "hidden" = "hidden") =>
    (defaultFields[key]?.visibility as "required" | "optional" | "hidden" | undefined) ?? fallback;

  const isRequired = (visibility: string) => visibility === "required";
  const isVisible = (visibility: string) => visibility !== "hidden";

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullNameVisibility = fieldVisibility("full_name", "required");
    const emailVisibility = fieldVisibility("email", "required");
    const phoneVisibility = fieldVisibility("phone", "optional");
    const resumeVisibility = fieldVisibility("resume", "hidden");
    const coverVisibility = fieldVisibility("cover_letter", "hidden");

    if (isRequired(fullNameVisibility) && !applyForm.fullName.trim())
      return toast.error("Full name is required.");
    if (isRequired(emailVisibility) && !applyForm.email.trim())
      return toast.error("Email is required.");
    if (isRequired(phoneVisibility) && !applyForm.phone.trim())
      return toast.error("Phone is required.");
    if (isRequired(resumeVisibility) && !applyForm.files.resume)
      return toast.error("Resume is required.");
    if (isRequired(coverVisibility) && !applyForm.files.cover_letter) {
      return toast.error("Cover letter is required.");
    }

    for (const field of [...profileLinkFields, ...customFields]) {
      const key = String(field.key ?? field.id ?? "");
      const label = String(field.label ?? key);
      const visibility = String(field.visibility ?? "hidden");
      if (!key || visibility === "hidden") continue;
      if (visibility === "required") {
        const val = applyForm.answers[key];
        if (val == null || (typeof val === "string" && !val.trim())) {
          return toast.error(`${label} is required.`);
        }
      }
    }

    setApplySubmitting(true);
    (async () => {
      try {
        const payloadAnswers: Record<string, unknown> = {};
        for (const field of [...profileLinkFields, ...customFields]) {
          const key = String(field.key ?? field.id ?? "");
          const visibility = String(field.visibility ?? "hidden");
          if (!key || visibility === "hidden") continue;
          const val = applyForm.answers[key];
          if (val == null) continue;
          if (typeof val === "string") {
            const trimmed = val.trim();
            if (!trimmed) continue;
            payloadAnswers[key] = trimmed;
          } else if (Array.isArray(val)) {
            if (val.length) payloadAnswers[key] = val;
          } else {
            payloadAnswers[key] = val;
          }
        }

        const payloadFiles: Record<string, unknown> = {};
        for (const [key, fileMeta] of Object.entries(applyForm.files)) {
          if (!fileMeta) continue;
          payloadFiles[key] = fileMeta.name;
        }

        const parsedOrg = parseOrgSlug(orgSlug);
        if (!parsedOrg) {
          toast.error("Invalid organization");
          setApplySubmitting(false);
          return;
        }
        await applyToPublicJob(parsedOrg.orgId, jobId, parsedOrg.orgName, {
          full_name: applyForm.fullName,
          email: applyForm.email,
          phone: applyForm.phone || null,
          answers: payloadAnswers,
          files: Object.keys(payloadFiles).length ? payloadFiles : undefined,
        });
        setApplySubmitting(false);
        closeApplyDialog();
        toast.success("Application submitted. We'll be in touch!");
      } catch (err) {
        setApplySubmitting(false);
        toast.error(err instanceof Error ? err.message : "Failed to submit application");
      }
    })();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  console.log(job);

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-xl font-semibold">Job not found</h1>
          <p className="text-sm text-muted-foreground">
            {error || "This job posting is no longer available."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs mt-4"
            onClick={() => router.push(`/${orgSlug}`)}
          >
            <Icon name="ChevronLeft" className="h-3.5 w-3.5 mr-1.5" /> View all positions
          </Button>
        </div>
      </div>
    );
  }

  const salary = formatSalary(job);
  const locationLabel = formatLocation(job);
  const employmentType = formatEmploymentType(job.employment_type);

  const showWorkplacePill =
    Boolean(job.workplace_type) &&
    (locationLabel != null ||
      String(job.workplace_type).toLowerCase() !== "onsite");

  const metaItems = [
    locationLabel && { iconName: "MapPin", label: locationLabel },
    showWorkplacePill && { iconName: "Clock", label: job.workplace_type },
    { iconName: "Briefcase", label: employmentType },
    salary && { iconName: "DollarSign", label: salary },
    job.category && { iconName: "Building2", label: job.category },
  ].filter(Boolean) as { iconName: IconName; label: string }[];

  const listHref = `/${orgSlug}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Status Banner for Org Members */}
      {job.status === "draft" && (
        <div className="bg-black text-white text-center py-2.5 text-sm font-medium">
          This job is saved as draft
        </div>
      )}
      {job.status === "archived" && (
        <div className="bg-black text-white text-center py-2.5 text-sm font-medium">
          This job is archived
        </div>
      )}

      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => router.push(listHref)}
          >
            <Icon name="ChevronLeft" className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Avatar
              className="h-7 w-7 shrink-0 rounded-md"
              src={job.org_avatar_url}
              alt={job.org_name || orgName}
              imageClassName="rounded-md object-cover"
              fallbackClassName="rounded-md bg-foreground text-background text-[10px] font-bold"
            />
            <span className="text-sm font-semibold truncate">
              {job.org_name}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-8 md:pt-12 pb-6 md:pb-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{job.title}</h1>
              {job.status === "draft" && (
                <Badge variant="secondary" className="text-[10px] h-5 px-2">
                  Draft
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {metaItems.map((item, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                <Icon name={item.iconName} className="h-3 w-3 shrink-0" />
                <span className="capitalize">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              size={isMobile ? "lg" : "default"}
              className={cn("text-sm", isMobile && "w-full h-12")}
              onClick={openApplyDialog}
            >
              Apply for this position
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="mx-auto max-w-3xl px-4 py-8 md:py-10 space-y-10">
        {job.description ? (
          <div
            className="prose prose-sm max-w-none text-foreground 
              [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_p]:mb-3
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5
              [&_li]:text-sm [&_li]:text-muted-foreground [&_li]:leading-relaxed
              [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2"
            dangerouslySetInnerHTML={{ __html: job.description }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No description available.</p>
        )}

        <Separator />

        <div className="text-center space-y-3 py-4">
          <h2 className="text-lg font-semibold">Interested in this role?</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            We&apos;d love to hear from you. Apply now and our team will review your application.
          </p>
          <Button
            size={isMobile ? "lg" : "default"}
            className={cn("text-sm mt-2", isMobile && "w-full h-12")}
            onClick={openApplyDialog}
          >
            Apply for this position
          </Button>
        </div>
      </div>

      <Dialog
        open={applyDialogOpen}
        onOpenChange={(open) => {
          setApplyDialogOpen(open);
          if (!open) setApplyForm({ fullName: "", email: "", phone: "", answers: {}, files: {} });
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Apply for {job.title}</DialogTitle>
            <DialogDescription>
              Submit your application to {job.org_name}. We'll review it and get back to you.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApplySubmit} className="mt-2 flex min-h-0 flex-1 flex-col">
            <div className="space-y-4 overflow-y-auto pr-1">
              {isVisible(fieldVisibility("full_name", "required")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.full_name?.label ?? "Full name"}{" "}
                    {isRequired(fieldVisibility("full_name", "required")) ? "*" : "(optional)"}
                  </Label>
                  <InputField
                    value={applyForm.fullName}
                    onChange={(e) => setApplyForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Jane Doe"
                    className="mt-1.5 h-9 text-sm"
                    required={isRequired(fieldVisibility("full_name", "required"))}
                  />
                </div>
              )}
              {isVisible(fieldVisibility("email", "required")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.email?.label ?? "Email"}{" "}
                    {isRequired(fieldVisibility("email", "required")) ? "*" : "(optional)"}
                  </Label>
                  <InputField
                    type="email"
                    value={applyForm.email}
                    onChange={(e) => setApplyForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="jane@example.com"
                    className="mt-1.5 h-9 text-sm"
                    required={isRequired(fieldVisibility("email", "required"))}
                  />
                </div>
              )}
              {isVisible(fieldVisibility("phone", "optional")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.phone?.label ?? "Phone"}{" "}
                    {isRequired(fieldVisibility("phone", "optional")) ? "*" : "(optional)"}
                  </Label>
                  <InputField
                    type="tel"
                    value={applyForm.phone}
                    onChange={(e) => setApplyForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                    className="mt-1.5 h-9 text-sm"
                    required={isRequired(fieldVisibility("phone", "optional"))}
                  />
                </div>
              )}
              {isVisible(fieldVisibility("resume", "hidden")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.resume?.label ?? "Resume"}{" "}
                    {isRequired(fieldVisibility("resume", "hidden")) ? "*" : "(optional)"}
                  </Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border border-dashed px-4 py-3 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                      <Icon name="Upload" className="h-4 w-4 shrink-0" />
                      <span>{applyForm.files.resume?.name ?? "Choose file or drag and drop"}</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          setApplyForm((f) => ({
                            ...f,
                            files: {
                              ...f.files,
                              resume: file
                                ? { name: file.name, size: file.size, type: file.type }
                                : undefined,
                            },
                          }));
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
              {isVisible(fieldVisibility("cover_letter", "hidden")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.cover_letter?.label ?? "Cover letter"}{" "}
                    {isRequired(fieldVisibility("cover_letter", "hidden")) ? "*" : "(optional)"}
                  </Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border border-dashed px-4 py-3 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                      <Icon name="Upload" className="h-4 w-4 shrink-0" />
                      <span>
                        {applyForm.files.cover_letter?.name ?? "Choose file or drag and drop"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          setApplyForm((f) => ({
                            ...f,
                            files: {
                              ...f.files,
                              cover_letter: file
                                ? { name: file.name, size: file.size, type: file.type }
                                : undefined,
                            },
                          }));
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
              {profileLinkFields.some((f) => String(f.visibility ?? "hidden") !== "hidden") && (
                <div className="pt-1">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Profile Links
                  </Label>
                </div>
              )}
              {profileLinkFields
                .filter((f) => String(f.visibility ?? "hidden") !== "hidden")
                .map((field) => {
                  const key = String(field.key ?? field.id ?? "");
                  if (!key) return null;
                  const label = String(field.label ?? key);
                  const required = String(field.visibility ?? "optional") === "required";
                  const value = applyForm.answers[key];
                  return (
                    <div key={key}>
                      <Label className="text-xs">
                        {label} {required ? "*" : "(optional)"}
                      </Label>
                      <InputField
                        type="url"
                        value={String(value ?? "")}
                        onChange={(e) =>
                          setApplyForm((f) => ({
                            ...f,
                            answers: { ...f.answers, [key]: e.target.value },
                          }))
                        }
                        placeholder="https://"
                        className="mt-1.5 h-9 text-sm"
                      />
                    </div>
                  );
                })}
              {customFields.some((f) => String(f.visibility ?? "hidden") !== "hidden") && (
                <div className="pt-1">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Additional Questions
                  </Label>
                </div>
              )}
              {customFields
                .filter((f) => String(f.visibility ?? "hidden") !== "hidden")
                .map((field) => {
                  const key = String(field.key ?? field.id ?? "");
                  if (!key) return null;
                  const label = String(field.label ?? key);
                  const type = String(field.type ?? "short_text");
                  const required = String(field.visibility ?? "optional") === "required";
                  const options = Array.isArray(field.options) ? (field.options as string[]) : [];
                  const value = applyForm.answers[key];
                  return (
                    <div key={key}>
                      <Label className="text-xs">
                        {label} {required ? "*" : "(optional)"}
                      </Label>
                      {type === "long_text" ? (
                        <textarea
                          value={String(value ?? "")}
                          onChange={(e) =>
                            setApplyForm((f) => ({
                              ...f,
                              answers: { ...f.answers, [key]: e.target.value },
                            }))
                          }
                          rows={3}
                          className={cn(
                            "mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          )}
                        />
                      ) : type === "single_select" ? (
                        <select
                          value={String(value ?? "")}
                          onChange={(e) =>
                            setApplyForm((f) => ({
                              ...f,
                              answers: { ...f.answers, [key]: e.target.value },
                            }))
                          }
                          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select</option>
                          {options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : type === "multi_select" ? (
                        <div className="mt-1.5 space-y-1">
                          {options.map((opt) => {
                            const selected = Array.isArray(value) ? (value as string[]) : [];
                            return (
                              <label key={opt} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={selected.includes(opt)}
                                  onChange={(e) => {
                                    const next = new Set(selected);
                                    if (e.target.checked) next.add(opt);
                                    else next.delete(opt);
                                    setApplyForm((f) => ({
                                      ...f,
                                      answers: { ...f.answers, [key]: Array.from(next) },
                                    }));
                                  }}
                                />
                                {opt}
                              </label>
                            );
                          })}
                        </div>
                      ) : type === "yes_no" ? (
                        <select
                          value={String(value ?? "")}
                          onChange={(e) =>
                            setApplyForm((f) => ({
                              ...f,
                              answers: { ...f.answers, [key]: e.target.value },
                            }))
                          }
                          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      ) : type === "file_upload" ? (
                        <label className="mt-1.5 flex-1 flex items-center justify-center gap-2 rounded-lg border border-border border-dashed px-4 py-3 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                          <Icon name="Upload" className="h-4 w-4 shrink-0" />
                          <span>
                            {applyForm.files[key]?.name ?? "Choose file or drag and drop"}
                          </span>
                          <input
                            type="file"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              setApplyForm((f) => ({
                                ...f,
                                files: {
                                  ...f.files,
                                  [key]: file
                                    ? { name: file.name, size: file.size, type: file.type }
                                    : undefined,
                                },
                              }));
                            }}
                          />
                        </label>
                      ) : (
                        <InputField
                          type={
                            type === "number"
                              ? "number"
                              : type === "date"
                                ? "date"
                                : type === "url"
                                  ? "url"
                                  : "text"
                          }
                          value={String(value ?? "")}
                          onChange={(e) =>
                            setApplyForm((f) => ({
                              ...f,
                              answers: { ...f.answers, [key]: e.target.value },
                            }))
                          }
                          className="mt-1.5 h-9 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
            </div>
            <DialogFooter className="mt-4 shrink-0 border-t pt-3 gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" onClick={closeApplyDialog}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={applySubmitting}>
                {applySubmitting ? "Submitting…" : "Submit application"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-xs text-muted-foreground capitalize text-center">
            © {new Date().getFullYear()} {PLATFORM_NAME}.
          </p>
        </div>
      </footer>
    </div>
  );
}
