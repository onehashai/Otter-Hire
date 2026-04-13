"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Avatar } from "@onehash/ui/avatar";
import { Separator } from "@onehash/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@onehash/ui/dialog";
import { Icon } from "@onehash/ui/icon";
import { InputField, PhoneNumberField, isValidPhoneNumber } from "@onehash/ui/input";
import { formatTimestamp } from "@/lib/format-date";
import { Label } from "@onehash/ui/label";
import { formatPhoneForDisplay, parseStoredPhone } from "@/lib/phone";
import { getInitialsFromName } from "@/lib/name-initials";
import { useTranslation } from "react-i18next";
import { isValidEmail, normalizeEmail, sanitizePhoneInput } from "@/lib/validation/contact";
import { Dribbble, Github, Globe, Link2, Linkedin, Palette, Twitter } from "lucide-react";

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
  address: string;
  stage: string;
  source: string;
  appliedDate: string;
  documents: Document[];
  profileLinks?: Record<string, string>;
  tags: string[];
}

interface TimelineItem {
  action: string;
  date: string;
  user: string;
  icon: string;
}

interface ProfileLinkField {
  key: string;
  label: string;
  required: boolean;
}

interface SummaryPanelProps {
  candidate: CandidateSummary;
  /** Standalone /candidates profile hides pipeline stage; job workspace shows full hiring summary. */
  variant?: "job" | "standalone";
  onSaveProfile: (payload: {
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
  }) => Promise<void>;
  onSaveLinks: (payload: Record<string, string>) => Promise<void>;
  onReplaceResume?: (file: File) => Promise<void>;
  onRemoveResume?: () => Promise<void>;
  // Props used by standalone candidate profile (/candidates/[id]).
  onUploadDocument?: () => void;
  onDeleteDocument?: (documentId: string) => void;
  profileLinkFields?: ProfileLinkField[];
  timeline?: TimelineItem[];
}

function formatDisplayFileName(rawName: string): string {
  const base = decodeURIComponent((rawName || "").split("/").pop() || rawName || "document");
  const withoutUuidPrefix = base.replace(/^[0-9a-f]{8,}-[0-9a-f-]{20,}_(.+)$/i, "$1");
  const clean = withoutUuidPrefix.replace(/^tmp-\d+-\d+_(.+)$/i, "$1");
  return clean || base;
}

function resolveProfileLinkIcon(key: string, value: string) {
  const normalizedKey = key.toLowerCase();
  const raw = (value || "").trim();
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let hostname = "";
  try {
    hostname = new URL(href).hostname.toLowerCase();
  } catch {
    hostname = "";
  }

  if (normalizedKey.includes("github") || hostname.includes("github.com")) {
    return <Github className="h-3.5 w-3.5" />;
  }
  if (normalizedKey.includes("linkedin") || hostname.includes("linkedin.com")) {
    return <Linkedin className="h-3.5 w-3.5" />;
  }
  if (
    normalizedKey.includes("twitter") ||
    normalizedKey.includes("twitter_x") ||
    hostname.includes("twitter.com") ||
    hostname === "x.com" ||
    hostname.endsWith(".x.com")
  ) {
    return <Twitter className="h-3.5 w-3.5" />;
  }
  if (normalizedKey.includes("dribbble") || hostname.includes("dribbble.com")) {
    return <Dribbble className="h-3.5 w-3.5" />;
  }
  if (normalizedKey.includes("behance") || hostname.includes("behance.net")) {
    return <Palette className="h-3.5 w-3.5" />;
  }
  if (
    normalizedKey.includes("portfolio") ||
    normalizedKey.includes("website") ||
    normalizedKey.includes("site")
  ) {
    return <Globe className="h-3.5 w-3.5" />;
  }
  return <Link2 className="h-3.5 w-3.5" />;
}

const TimelineIcon = ({ type }: { type: string }) => {
  const cls = "h-3.5 w-3.5";
  if (type === "apply") return <Icon name="Users" className={cls} />;
  if (type === "move") return <Icon name="UserCheck" className={cls} />;
  if (type === "feedback") return <Icon name="Send" className={cls} />;
  return <Icon name="Clock" className={cls} />;
};

export function SummaryPanel({
  candidate,
  variant = "job",
  onSaveProfile,
  onSaveLinks,
  onReplaceResume,
  onRemoveResume,
  onUploadDocument,
  onDeleteDocument,
  profileLinkFields,
  timeline = [],
}: SummaryPanelProps) {
  const { t } = useTranslation();
  const initials = getInitialsFromName(candidate.name);
  const [profileEdit, setProfileEdit] = useState(false);
  const [linksEdit, setLinksEdit] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const [name, setName] = useState(candidate.name);
  const [email, setEmail] = useState(candidate.email);
  const [phone, setPhone] = useState<string | undefined>(() => parseStoredPhone(candidate.phone));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [address, setAddress] = useState(candidate.address === "—" ? "" : candidate.address);

  const [linkDraft, setLinkDraft] = useState<Record<string, string>>(() => ({
    ...(candidate.profileLinks || {}),
  }));

  useEffect(() => {
    setName(candidate.name);
    setEmail(candidate.email);
    setPhone(parseStoredPhone(candidate.phone));
    setPhoneError(null);
    setEmailError(null);
    setAddress(candidate.address === "—" ? "" : candidate.address);
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
      Object.entries(candidate.profileLinks || {}).filter(
        ([, value]) => typeof value === "string" && value.trim(),
      ),
    [candidate.profileLinks],
  );

  const resumeDoc = useMemo(() => {
    return (
      candidate.documents.find((d) => d.type?.toLowerCase() === "resume") ??
      candidate.documents.find((d) => d.name?.toLowerCase().includes("resume")) ??
      candidate.documents[0] ??
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
              <InputField
                label="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                error={emailError ?? undefined}
              />
              <PhoneNumberField
                value={phone}
                onChange={(v) => {
                  setPhone(v ? sanitizePhoneInput(v) : v);
                  setPhoneError(null);
                }}
                error={phoneError ?? undefined}
              />
              <InputField
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={
                    savingProfile ||
                    !name.trim() ||
                    !email.trim() ||
                    !isValidEmail(email) ||
                    !!(phone && !isValidPhoneNumber(phone))
                  }
                  onClick={async () => {
                    if (!isValidEmail(email)) {
                      setEmailError("Enter a valid email address.");
                      return;
                    }
                    if (phone && !isValidPhoneNumber(phone)) {
                      setPhoneError("Enter a valid phone number for the selected country.");
                      return;
                    }
                    try {
                      setSavingProfile(true);
                      setPhoneError(null);
                      await onSaveProfile({
                        name: name.trim(),
                        email: normalizeEmail(email),
                        phone: phone ?? null,
                        address: address.trim() || null,
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
                    setEmailError(null);
                    setAddress(candidate.address === "—" ? "" : candidate.address);
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
                  <Icon name="House" className="h-3.5 w-3.5" /> {candidate.address}
                </div>
              </div>
              <Separator />
              {variant === "job" ? (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Hiring Timeline
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-fit text-xs gap-1.5"
                    onClick={() => setTimelineOpen(true)}
                  >
                    <Icon name="Clock" className="h-3.5 w-3.5" />
                    View timeline
                  </Button>
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
                  {t("candidates_table_created")}
                </Label>
                <p className="text-xs">{formatTimestamp(candidate.appliedDate)}</p>
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
                Resume:{" "}
                {resumeFile
                  ? resumeFile.name
                  : hasResume
                    ? formatDisplayFileName(resumeDoc.name)
                    : "—"}
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
                const icon = resolveProfileLinkIcon(key, value);
                return (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs w-full justify-start gap-2"
                    asChild
                  >
                    <a href={value} target="_blank" rel="noreferrer">
                      {icon}
                      <span className="truncate flex-1 text-left">{value}</span>
                    </a>
                  </Button>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hiring Status Timeline</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden pr-1">
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hiring status updates yet.</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((item, i) => (
                  <div key={`${item.date}-${i}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <TimelineIcon type={item.icon} />
                      </div>
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-3">
                      <p className="text-xs font-medium">{item.action}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {formatTimestamp(item.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="justify-end">
            <Button size="sm" className="h-8 text-xs" onClick={() => setTimelineOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
