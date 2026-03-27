"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Avatar } from "@onehash/ui/avatar";
import { Separator } from "@onehash/ui/separator";
import { Icon } from "@onehash/ui/icon";
import { InputField, PhoneNumberField, isValidPhoneNumber } from "@onehash/ui/input";
import { SelectField } from "@onehash/ui/select";
import { formatTimestampToDateTime } from "@/lib/format-date";
import { Label } from "@onehash/ui/label";
import { formatPhoneForDisplay, parseStoredPhone } from "@/lib/phone";
import { getInitialsFromName } from "@/lib/name-initials";
import { useTranslation } from "react-i18next";

interface Document {
  id?: string;
  name: string;
  type: string;
  date: string;
  size: string;
  url?: string;
}

interface CandidateSummary {
  name: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  stage: string;
  source: string;
  appliedDate: string;
  documents: Document[];
  profileLinks?: Record<string, string>;
  tags: string[];
  jobId?: string | null;
}

interface ProfileLinkField {
  key: string;
  label: string;
  required: boolean;
}

interface SummaryPanelProps {
  candidate: CandidateSummary;
  jobs: Array<{ id: string; title: string }>;
  /** Talent pool hides pipeline stage; job shows full hiring summary. */
  variant?: "job" | "talent_pool";
  onSaveProfile: (payload: {
    name: string;
    email: string;
    phone: string | null;
    location: string | null;
    job_id?: string | null;
    clear_job?: boolean;
  }) => Promise<void>;
  onSaveLinks: (payload: Record<string, string>) => Promise<void>;
  onReplaceResume?: (file: File) => Promise<void>;
  onRemoveResume?: () => Promise<void>;
  // Backward-compatible props used in talent pool profile.
  onUploadDocument?: () => void;
  onDeleteDocument?: (documentId: string) => void;
  profileLinkFields?: ProfileLinkField[];
}

function formatDisplayFileName(rawName: string): string {
  const base = decodeURIComponent((rawName || "").split("/").pop() || rawName || "document");
  const withoutUuidPrefix = base.replace(/^[0-9a-f]{8,}-[0-9a-f-]{20,}_(.+)$/i, "$1");
  const clean = withoutUuidPrefix.replace(/^tmp-\d+-\d+_(.+)$/i, "$1");
  return clean || base;
}

const stageVariant = (stage: string) => {
  if (stage === "Hired") return "default" as const;
  if (stage === "Rejected") return "destructive" as const;
  return "secondary" as const;
};

export function SummaryPanel({
  candidate,
  jobs,
  variant = "job",
  onSaveProfile,
  onSaveLinks,
  onReplaceResume,
  onRemoveResume,
  onUploadDocument,
  onDeleteDocument,
  profileLinkFields,
}: SummaryPanelProps) {
  const { t } = useTranslation();
  const initials = getInitialsFromName(candidate.name);
  const [profileEdit, setProfileEdit] = useState(false);
  const [linksEdit, setLinksEdit] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [name, setName] = useState(candidate.name);
  const [email, setEmail] = useState(candidate.email);
  const [phone, setPhone] = useState<string | undefined>(() => parseStoredPhone(candidate.phone));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [location, setLocation] = useState(candidate.location === "—" ? "" : candidate.location);
  const [jobId, setJobId] = useState(candidate.jobId ?? "__no_job__");

  const [linkDraft, setLinkDraft] = useState<Record<string, string>>(() => ({
    ...(candidate.profileLinks || {}),
  }));

  useEffect(() => {
    setName(candidate.name);
    setEmail(candidate.email);
    setPhone(parseStoredPhone(candidate.phone));
    setPhoneError(null);
    setLocation(candidate.location === "—" ? "" : candidate.location);
    setJobId(candidate.jobId ?? "__no_job__");
    setLinkDraft({ ...(candidate.profileLinks || {}) });
    setResumeFile(null);
  }, [candidate]);

  const editableProfileLinkFields = useMemo<ProfileLinkField[]>(() => {
    if (profileLinkFields && profileLinkFields.length > 0) return profileLinkFields;
    return [
      { key: "linkedin", label: "LinkedIn", required: false },
      { key: "portfolio", label: "Portfolio", required: false },
    ];
  }, [profileLinkFields]);

  const nonEmptyProfileLinks = useMemo(
    () =>
      Object.entries(candidate.profileLinks || {}).filter(([, value]) => typeof value === "string" && value.trim()),
    [candidate.profileLinks],
  );

  const resumeDoc = useMemo(() => {
    return (
      candidate.documents.find((d) => d.type?.toLowerCase() === "resume") ??
      candidate.documents.find((d) => d.name?.toLowerCase().includes("resume")) ??
      null
    );
  }, [candidate.documents]);
  const hasResume = Boolean(resumeDoc);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12" fallbackClassName="bg-muted text-sm font-medium">
                {initials}
              </Avatar>
              <div>
                <h2 className="text-base font-semibold">{candidate.name}</h2>
                <p className="text-xs text-muted-foreground">{candidate.role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setProfileEdit((v) => !v)}
            >
              <Icon name="PenLine" className="h-4 w-4" />
            </Button>
          </div>

          {profileEdit ? (
            <div className="space-y-3">
              <InputField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              {jobId === "__no_job__" ? (
                <SelectField
                  label="Job"
                  value={jobId}
                  onValueChange={setJobId}
                  options={[
                    { value: "__no_job__", label: "+ Add Job" },
                    ...jobs.map((j) => ({ value: j.id, label: j.title })),
                  ]}
                />
              ) : (
                <SelectField
                  label="Job"
                  value={jobId}
                  onValueChange={setJobId}
                  options={[
                    { value: "__no_job__", label: "No job (Talent Pool)" },
                    ...jobs.map((j) => ({ value: j.id, label: j.title })),
                  ]}
                />
              )}
              <InputField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <PhoneNumberField
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  setPhoneError(null);
                }}
                error={phoneError ?? undefined}
              />
              <InputField
                label="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={
                    savingProfile ||
                    !name.trim() ||
                    !email.trim() ||
                    !!(phone && !isValidPhoneNumber(phone))
                  }
                  onClick={async () => {
                    if (phone && !isValidPhoneNumber(phone)) {
                      setPhoneError("Enter a valid phone number for the selected country.");
                      return;
                    }
                    try {
                      setSavingProfile(true);
                      setPhoneError(null);
                      await onSaveProfile({
                        name: name.trim(),
                        email: email.trim(),
                        phone: phone ?? null,
                        location: location.trim() || null,
                        ...(jobId === "__no_job__" ? { clear_job: true } : { job_id: jobId }),
                      });
                      setProfileEdit(false);
                    } finally {
                      setSavingProfile(false);
                    }
                  }}
                  pending={savingProfile}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setProfileEdit(false);
                    setName(candidate.name);
                    setEmail(candidate.email);
                    setPhone(parseStoredPhone(candidate.phone));
                    setPhoneError(null);
                    setLocation(candidate.location === "—" ? "" : candidate.location);
                    setJobId(candidate.jobId ?? "__no_job__");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="Mail" className="h-3.5 w-3.5" /> {candidate.email}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="Phone" className="h-3.5 w-3.5" />{" "}
                  {formatPhoneForDisplay(candidate.phone)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="House" className="h-3.5 w-3.5" /> {candidate.location}
                </div>
              </div>
              <Separator />
              {variant === "job" ? (
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Stage
                  </Label>
                  <Badge variant={stageVariant(candidate.stage)} className="text-[10px] w-fit">
                    {candidate.stage}
                  </Badge>
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Source
                </Label>
                <Badge variant="outline" className="text-[10px] w-fit">
                  {candidate.source}
                </Badge>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t("applied")}
                </Label>
                <p className="text-xs">{formatTimestampToDateTime(candidate.appliedDate)}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Resume & Links
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setLinksEdit((v) => !v)}
          >
            <Icon name="PenLine" className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {linksEdit ? (
            <>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => {
                    if (onReplaceResume) {
                      const input = document.getElementById("summary-resume-replace-input");
                      input?.click();
                      return;
                    }
                    onUploadDocument?.();
                  }}
                >
                  <Icon name="Upload" className="h-3.5 w-3.5" /> Upload
                </Button>
                {onReplaceResume ? (
                  <input
                    id="summary-resume-replace-input"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  />
                ) : null}
                {hasResume && (onRemoveResume || onDeleteDocument) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
                    onClick={() => {
                      void (async () => {
                        if (onRemoveResume) {
                          await onRemoveResume();
                          return;
                        }
                        const fallbackResumeId = resumeDoc?.id;
                        if (fallbackResumeId && onDeleteDocument) {
                          onDeleteDocument(fallbackResumeId);
                        }
                      })();
                    }}
                  >
                    <Icon name="Trash2" className="h-3.5 w-3.5" /> Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Resume: {resumeFile ? resumeFile.name : hasResume ? formatDisplayFileName(resumeDoc.name) : "—"}
              </p>
              {editableProfileLinkFields.map((field) => (
                <InputField
                  key={field.key}
                  label={`${field.label}${field.required ? " *" : ""}`}
                  value={linkDraft[field.key] ?? ""}
                  onChange={(e) =>
                    setLinkDraft((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                />
              ))}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={savingLinks}
                  onClick={async () => {
                    try {
                      setSavingLinks(true);
                      if (resumeFile && onReplaceResume) {
                        await onReplaceResume(resumeFile);
                      }
                      await onSaveLinks(linkDraft);
                      setLinksEdit(false);
                      setResumeFile(null);
                    } finally {
                      setSavingLinks(false);
                    }
                  }}
                  pending={savingLinks}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setLinksEdit(false);
                    setLinkDraft({ ...(candidate.profileLinks || {}) });
                    setResumeFile(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              {resumeDoc ? (
                <Button
                  key={resumeDoc.id ?? "resume-doc"}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs w-full justify-start gap-2"
                  asChild
                >
                  <a href={resumeDoc.url} target="_blank" rel="noreferrer">
                    <Icon name="ScrollText" className="h-3.5 w-3.5" />
                    <span className="truncate flex-1 text-left">
                      {formatDisplayFileName(resumeDoc.name)}
                    </span>
                  </a>
                </Button>
              ) : null}
              {nonEmptyProfileLinks.map(([key, value]) => {
                const label =
                  editableProfileLinkFields.find((f) => f.key === key)?.label ??
                  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs w-full justify-start gap-2"
                    asChild
                  >
                    <a href={value} target="_blank" rel="noreferrer">
                      <Icon name="Link" className="h-3.5 w-3.5" />
                      <span className="truncate flex-1 text-left">{`${label}: ${value}`}</span>
                    </a>
                  </Button>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
