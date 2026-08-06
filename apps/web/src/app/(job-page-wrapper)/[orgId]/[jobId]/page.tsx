"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
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
import { InputField, PhoneNumberField, isValidPhoneNumber } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { Avatar } from "@onehash/ui/avatar";
import { Icon } from "@onehash/ui/icon";
import type { IconName } from "@onehash/ui/icon";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toast } from "@onehash/ui/sonner";
import {
  applyToPublicJob,
  getPublicJobDetail,
  uploadPublicApplicationFile,
  type PublicJobDetail,
} from "@/api";
import { PLATFORM_NAME } from "@/lib/constants";
import { parseCareersOrgId } from "@/lib/public-careers-org";
import { isValidEmail, normalizeEmail } from "@/lib/validation/contact";
import { JobsI18nProvider } from "@/components/public/JobsI18nProvider";

type ApplyFile = {
  name: string;
  size: number;
  type: string;
  url?: string;
  uploading?: boolean;
};

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

// Inner component — rendered only once job is loaded; has access to i18n via JobsI18nProvider
function JobDetailContent({ job, orgIdParam }: { job: PublicJobDetail; orgIdParam: string }) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const jobId = job.id;

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    answers: {} as Record<string, unknown>,
    files: {} as Record<string, ApplyFile | undefined>,
  });
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applySubmitted, setApplySubmitted] = useState(false);
  const [applyErrors, setApplyErrors] = useState<Record<string, string>>({});

  const openApplyDialog = () => setApplyDialogOpen(true);
  const closeApplyDialog = () => {
    setApplyDialogOpen(false);
    setApplyForm({ fullName: "", email: "", phone: "", answers: {}, files: {} });
    setApplyErrors({});
  };

  const applicationSchema = (job?.application_form_schema ?? {}) as Record<string, unknown>;

  const defaultFields = useMemo(
    () =>
      (applicationSchema.default_fields ?? {}) as Record<
        string,
        { visibility?: string; label?: string }
      >,
    [applicationSchema.default_fields],
  );

  const schemaProfileLinks = Array.isArray(applicationSchema.profile_links)
    ? (applicationSchema.profile_links as Array<Record<string, unknown>>)
    : [];

  const schemaCustomFields = useMemo(
    () =>
      Array.isArray(applicationSchema.custom_fields)
        ? (applicationSchema.custom_fields as Array<Record<string, unknown>>)
        : [],
    [applicationSchema.custom_fields],
  );

  const profileLinkMap = new Map<string, Record<string, unknown>>();
  for (const linkField of schemaProfileLinks) {
    const key = String(linkField.key ?? linkField.id ?? "");
    if (key) profileLinkMap.set(key, linkField);
  }

  const customFields = useMemo(() => {
    const fields: Array<Record<string, unknown>> = [];
    for (const field of schemaCustomFields) {
      const key = String(field.key ?? field.id ?? "");
      if (key.startsWith("profile_link_")) {
        continue;
      }
      fields.push(field);
    }
    return fields;
  }, [schemaCustomFields]);

  const profileLinkFields = Array.from(profileLinkMap.values());

  const fieldVisibility = useCallback(
    (key: string, fallback: "required" | "optional" | "hidden" = "hidden") =>
      (defaultFields[key]?.visibility as "required" | "optional" | "hidden" | undefined) ??
      fallback,
    [defaultFields],
  );

  const isRequired = (visibility: string) => visibility === "required";
  const isVisible = (visibility: string) => visibility !== "hidden";

  const applyValidation = useMemo(() => {
    const fullNameVisibility = fieldVisibility("full_name", "required");
    const emailVisibility = fieldVisibility("email", "required");
    const phoneVisibility = fieldVisibility("phone", "optional");
    const resumeVisibility = fieldVisibility("resume", "hidden");
    const coverVisibility = fieldVisibility("cover_letter", "hidden");

    const errors: Record<string, string> = {};
    if (isRequired(fullNameVisibility) && !applyForm.fullName.trim()) {
      errors.fullName = t("full_name_required");
    }
    if (isRequired(emailVisibility) && !applyForm.email.trim()) {
      errors.email = t("email_required");
    }
    if (applyForm.email.trim() && !isValidEmail(applyForm.email)) {
      errors.email = t("email_invalid");
    }
    if (isRequired(phoneVisibility) && !applyForm.phone.trim()) {
      errors.phone = t("phone_required");
    }
    if (applyForm.phone.trim() && !isValidPhoneNumber(applyForm.phone)) {
      errors.phone = t("phone_invalid");
    }
    if (isRequired(resumeVisibility) && !applyForm.files.resume) {
      errors.resume = t("resume_required");
    }
    if (isRequired(coverVisibility) && !applyForm.files.cover_letter) {
      errors.cover_letter = t("cover_letter_required");
    }

    for (const field of [...profileLinkFields, ...customFields]) {
      const key = String(field.key ?? field.id ?? "");
      const label = String(field.label ?? key);
      const visibility = String(field.visibility ?? "hidden");
      const type = String(field.type ?? "short_text");
      if (!key || visibility === "hidden") continue;
      if (visibility === "required") {
        if (type === "file_upload") {
          const fileMeta = applyForm.files[key];
          if (!fileMeta || (!fileMeta.url && !fileMeta.name)) {
            errors[`file:${key}`] = t("field_required", { label });
          }
        } else {
          const val = applyForm.answers[key];
          if (val == null || (typeof val === "string" && !val.trim())) {
            errors[`answer:${key}`] = t("field_required", { label });
          }
        }
      }
    }

    const hasUploadingFiles = Object.values(applyForm.files).some((f) => f?.uploading);
    return { errors, hasUploadingFiles };
  }, [applyForm, profileLinkFields, customFields, fieldVisibility, t]);

  const handleSelectAndUploadFile = async (key: string, file: File | null) => {
    if (!file) return;
    const orgId = parseCareersOrgId(orgIdParam);
    if (!orgId) {
      toast.error(t("invalid_organization"));
      return;
    }
    setApplyForm((s) => ({
      ...s,
      files: {
        ...s.files,
        [key]: { name: file.name, size: file.size, type: file.type, uploading: true },
      },
    }));
    try {
      const uploaded = await uploadPublicApplicationFile(orgId, jobId, key, file);
      setApplyForm((s) => ({
        ...s,
        files: {
          ...s.files,
          [key]: {
            name: uploaded.name,
            size: uploaded.size_bytes,
            type: uploaded.content_type ?? file.type,
            url: uploaded.url,
            uploading: false,
          },
        },
      }));
    } catch (err) {
      setApplyForm((s) => ({ ...s, files: { ...s.files, [key]: undefined } }));
      toast.error(err instanceof Error ? err.message : t("failed_to_upload_file"));
    }
  };

  const handleApplySubmit = (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (applyValidation.hasUploadingFiles) {
      return toast.error(t("files_uploading"));
    }
    setApplyErrors(applyValidation.errors);
    if (Object.keys(applyValidation.errors).length > 0) return;

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
          payloadFiles[key] = fileMeta.url ?? fileMeta.name;
        }

        const orgId = parseCareersOrgId(orgIdParam);
        if (!orgId) {
          toast.error(t("invalid_organization"));
          setApplySubmitting(false);
          return;
        }
        await applyToPublicJob(orgId, jobId, {
          full_name: applyForm.fullName.trim(),
          email: normalizeEmail(applyForm.email),
          phone: applyForm.phone.trim() || null,
          answers: payloadAnswers,
          files: Object.keys(payloadFiles).length ? payloadFiles : undefined,
        });
        setApplySubmitting(false);
        setApplySubmitted(true);
        toast.success(t("application_submitted"));
        setTimeout(() => {
          closeApplyDialog();
          setApplySubmitted(false);
        }, 1500);
      } catch (err) {
        setApplySubmitting(false);
        toast.error(err instanceof Error ? err.message : t("failed_to_submit_application"));
      }
    })();
  };

  const salary = formatSalary(job);
  const locationLabel = formatLocation(job);
  const employmentType = formatEmploymentType(job.employment_type);

  const showWorkplacePill =
    Boolean(job.workplace_type) &&
    (locationLabel != null || String(job.workplace_type).toLowerCase() !== "onsite");

  const metaItems = [
    locationLabel && { iconName: "MapPin", label: locationLabel },
    showWorkplacePill && { iconName: "Clock", label: job.workplace_type },
    { iconName: "Briefcase", label: employmentType },
    salary && { iconName: "Banknote", label: salary },
    job.category && { iconName: "Building2", label: job.category },
  ].filter(Boolean) as { iconName: IconName; label: string }[];

  const listHref = `/${orgIdParam}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Status Banner for Org Members */}
      {job.status === "draft" && (
        <div className="bg-black text-white text-center py-2.5 text-sm font-medium">
          {t("this_job_is_draft")}
        </div>
      )}
      {job.status === "archived" && (
        <div className="bg-black text-white text-center py-2.5 text-sm font-medium">
          {t("this_job_is_archived")}
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
              alt={job.org_name}
              imageClassName="rounded-md object-cover"
              fallbackClassName="rounded-md bg-foreground text-background text-[10px] font-bold"
            />
            <span className="text-sm font-semibold truncate">{job.org_name}</span>
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
                  {t("draft")}
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
              {t("apply_for_this_position")}
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
          <p className="text-sm text-muted-foreground">{t("no_description_available")}</p>
        )}

        <Separator />

        <div className="text-center space-y-3 py-4">
          <h2 className="text-lg font-semibold">{t("interested_in_this_role")}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t("interested_in_this_role_description")}
          </p>
          <Button
            size={isMobile ? "lg" : "default"}
            className={cn("text-sm mt-2", isMobile && "w-full h-12")}
            onClick={openApplyDialog}
          >
            {t("apply_for_this_position")}
          </Button>
        </div>
      </div>

      <Dialog
        open={applyDialogOpen}
        onOpenChange={(open) => {
          setApplyDialogOpen(open);
          if (!open) {
            setApplyForm({ fullName: "", email: "", phone: "", answers: {}, files: {} });
            setApplyErrors({});
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{`${t("apply_for")} ${job.title}`}</DialogTitle>
            <DialogDescription>
              {t("we_review_your_application", { orgName: job.org_name })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApplySubmit} className="mt-2 space-y-4">
            <div className="space-y-4">
              {isVisible(fieldVisibility("full_name", "required")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.full_name?.label ?? t("full_name_label")}{" "}
                    {isRequired(fieldVisibility("full_name", "required")) ? "*" : t("optional")}
                  </Label>
                  <InputField
                    value={applyForm.fullName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setApplyForm((f) => ({ ...f, fullName: value }));
                      setApplyErrors((prev) => ({
                        ...prev,
                        fullName:
                          isRequired(fieldVisibility("full_name", "required")) && !value.trim()
                            ? t("full_name_required")
                            : "",
                      }));
                    }}
                    placeholder="Jane Doe"
                    className="mt-1.5 h-9 text-sm"
                    required={isRequired(fieldVisibility("full_name", "required"))}
                    error={applyErrors.fullName || undefined}
                  />
                </div>
              )}
              {isVisible(fieldVisibility("email", "required")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.email?.label ?? t("email")}{" "}
                    {isRequired(fieldVisibility("email", "required")) ? "*" : t("optional")}
                  </Label>
                  <InputField
                    type="email"
                    value={applyForm.email}
                    onChange={(e) => {
                      const value = e.target.value;
                      setApplyForm((f) => ({ ...f, email: value }));
                      let emailError = "";
                      if (isRequired(fieldVisibility("email", "required")) && !value.trim()) {
                        emailError = t("email_required");
                      } else if (value.trim() && !isValidEmail(value)) {
                        emailError = t("email_invalid");
                      }
                      setApplyErrors((prev) => ({ ...prev, email: emailError }));
                    }}
                    placeholder="jane@example.com"
                    className="mt-1.5 h-9 text-sm"
                    required={isRequired(fieldVisibility("email", "required"))}
                    error={applyErrors.email || undefined}
                  />
                </div>
              )}
              {isVisible(fieldVisibility("phone", "optional")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.phone?.label ?? t("phone_label")}{" "}
                    {isRequired(fieldVisibility("phone", "optional")) ? "*" : t("optional")}
                  </Label>
                  <PhoneNumberField
                    label=""
                    value={applyForm.phone || undefined}
                    onChange={(v) => {
                      const value = v ?? "";
                      setApplyForm((f) => ({ ...f, phone: value }));
                      let phoneError = "";
                      if (isRequired(fieldVisibility("phone", "optional")) && !value.trim()) {
                        phoneError = t("phone_required");
                      } else if (value.trim() && !isValidPhoneNumber(value)) {
                        phoneError = t("phone_invalid");
                      }
                      setApplyErrors((prev) => ({ ...prev, phone: phoneError }));
                    }}
                    error={applyErrors.phone || undefined}
                  />
                </div>
              )}
              {isVisible(fieldVisibility("resume", "hidden")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.resume?.label ?? t("resume")}{" "}
                    {isRequired(fieldVisibility("resume", "hidden")) ? "*" : t("optional")}
                  </Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border border-dashed px-4 py-3 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                      <Icon name="Upload" className="h-4 w-4 shrink-0" />
                      <span>{applyForm.files.resume?.name ?? t("choose_file_or_drag")}</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="sr-only"
                        onChange={(e) => {
                          void handleSelectAndUploadFile("resume", e.target.files?.[0] || null);
                          setApplyErrors((prev) => ({ ...prev, resume: "" }));
                        }}
                      />
                    </label>
                  </div>
                  {applyErrors.resume ? (
                    <p className="mt-1 text-xs text-destructive">{applyErrors.resume}</p>
                  ) : null}
                </div>
              )}
              {isVisible(fieldVisibility("cover_letter", "hidden")) && (
                <div>
                  <Label className="text-xs">
                    {defaultFields.cover_letter?.label ?? t("cover_letter_label")}{" "}
                    {isRequired(fieldVisibility("cover_letter", "hidden")) ? "*" : t("optional")}
                  </Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border border-dashed px-4 py-3 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                      <Icon name="Upload" className="h-4 w-4 shrink-0" />
                      <span>{applyForm.files.cover_letter?.name ?? t("choose_file_or_drag")}</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className="sr-only"
                        onChange={(e) => {
                          void handleSelectAndUploadFile(
                            "cover_letter",
                            e.target.files?.[0] || null,
                          );
                          setApplyErrors((prev) => ({ ...prev, cover_letter: "" }));
                        }}
                      />
                    </label>
                  </div>
                  {applyErrors.cover_letter ? (
                    <p className="mt-1 text-xs text-destructive">{applyErrors.cover_letter}</p>
                  ) : null}
                </div>
              )}
              {profileLinkFields.some((f) => String(f.visibility ?? "hidden") !== "hidden") && (
                <div className="pt-1">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("profile_links")}
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
                        {label} {required ? "*" : t("optional")}
                      </Label>
                      <InputField
                        type="url"
                        value={String(value ?? "")}
                        onChange={(e) => {
                          setApplyForm((f) => ({
                            ...f,
                            answers: { ...f.answers, [key]: e.target.value },
                          }));
                          setApplyErrors((prev) => ({ ...prev, [`answer:${key}`]: "" }));
                        }}
                        placeholder="https://"
                        className="mt-1.5 h-9 text-sm"
                      />
                      {applyErrors[`answer:${key}`] ? (
                        <p className="mt-1 text-xs text-destructive">
                          {applyErrors[`answer:${key}`]}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              {customFields.some((f) => String(f.visibility ?? "hidden") !== "hidden") && (
                <div className="pt-1">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("additional_questions")}
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
                        {label} {required ? "*" : t("optional")}
                      </Label>
                      {type === "long_text" ? (
                        <textarea
                          value={String(value ?? "")}
                          onChange={(e) => {
                            setApplyForm((f) => ({
                              ...f,
                              answers: { ...f.answers, [key]: e.target.value },
                            }));
                            setApplyErrors((prev) => ({ ...prev, [`answer:${key}`]: "" }));
                          }}
                          rows={3}
                          className={cn(
                            "mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          )}
                        />
                      ) : type === "single_select" ? (
                        <select
                          value={String(value ?? "")}
                          onChange={(e) => {
                            setApplyForm((f) => ({
                              ...f,
                              answers: { ...f.answers, [key]: e.target.value },
                            }));
                            setApplyErrors((prev) => ({ ...prev, [`answer:${key}`]: "" }));
                          }}
                          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">{t("select_option")}</option>
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
                                    setApplyErrors((prev) => ({ ...prev, [`answer:${key}`]: "" }));
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
                          onChange={(e) => {
                            setApplyForm((f) => ({
                              ...f,
                              answers: { ...f.answers, [key]: e.target.value },
                            }));
                            setApplyErrors((prev) => ({ ...prev, [`answer:${key}`]: "" }));
                          }}
                          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">{t("select_option")}</option>
                          <option value="yes">{t("yes")}</option>
                          <option value="no">{t("no")}</option>
                        </select>
                      ) : type === "file_upload" ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border border-dashed px-4 py-3 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                            <Icon name="Upload" className="h-4 w-4 shrink-0" />
                            <span>{applyForm.files[key]?.name ?? t("choose_file_or_drag")}</span>
                            <input
                              type="file"
                              className="sr-only"
                              onChange={(e) => {
                                void handleSelectAndUploadFile(key, e.target.files?.[0] || null);
                                setApplyErrors((prev) => ({ ...prev, [`file:${key}`]: "" }));
                              }}
                            />
                          </label>
                        </div>
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
                          onChange={(e) => {
                            setApplyForm((f) => ({
                              ...f,
                              answers: { ...f.answers, [key]: e.target.value },
                            }));
                            setApplyErrors((prev) => ({ ...prev, [`answer:${key}`]: "" }));
                          }}
                          className="mt-1.5 h-9 text-sm"
                        />
                      )}
                      {type === "file_upload" && applyErrors[`file:${key}`] ? (
                        <p className="mt-1 text-xs text-destructive">
                          {applyErrors[`file:${key}`]}
                        </p>
                      ) : null}
                      {type !== "file_upload" && applyErrors[`answer:${key}`] ? (
                        <p className="mt-1 text-xs text-destructive">
                          {applyErrors[`answer:${key}`]}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
            </div>
            <DialogFooter className="mt-4 gap-2 sm:gap-2">
              <Button type="button" variant="outline" size="sm" onClick={closeApplyDialog}>
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  applySubmitting ||
                  applySubmitted ||
                  applyValidation.hasUploadingFiles ||
                  Object.keys(applyValidation.errors).length > 0
                }
              >
                {applySubmitted
                  ? "Submitted!"
                  : applySubmitting
                    ? t("submitting")
                    : t("submit_application")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-xs text-muted-foreground capitalize text-center">
            {t("copyright", { year: new Date().getFullYear(), platformName: PLATFORM_NAME })}
          </p>
        </div>
      </footer>
    </div>
  );
}

// Outer component — handles data fetching; wraps inner content with JobsI18nProvider once loaded
export default function CareerJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgIdParam = params?.orgId as string;
  const jobId = params?.jobId as string;

  const [job, setJob] = useState<PublicJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const orgId = parseCareersOrgId(orgIdParam);
    if (!orgId) {
      setError("Invalid organization");
      setLoading(false);
      return;
    }

    getPublicJobDetail(orgId, jobId)
      .then((data) => {
        setJob(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Job not found");
        setLoading(false);
      });
  }, [orgIdParam, jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

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
            onClick={() => router.push(`/${orgIdParam}`)}
          >
            <Icon name="ChevronLeft" className="h-3.5 w-3.5 mr-1.5" /> View all positions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <JobsI18nProvider jobsPageLanguage={job.jobs_page_language ?? "en"}>
      <JobDetailContent job={job} orgIdParam={orgIdParam} />
    </JobsI18nProvider>
  );
}
