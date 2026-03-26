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
import { formatDayMonth } from "@/lib/format-date";
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
  linkedin?: string;
  portfolio?: string;
  tags: string[];
  jobId?: string | null;
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
  onSaveLinks: (payload: { linkedin?: string; portfolio?: string }) => Promise<void>;
  onUploadDocument?: () => void;
  onDeleteDocument?: (documentId: string) => void;
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
  onUploadDocument,
  onDeleteDocument,
}: SummaryPanelProps) {
  const { t } = useTranslation();
  const initials = getInitialsFromName(candidate.name);
  const [profileEdit, setProfileEdit] = useState(false);
  const [linksEdit, setLinksEdit] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);

  const [name, setName] = useState(candidate.name);
  const [email, setEmail] = useState(candidate.email);
  const [phone, setPhone] = useState<string | undefined>(() => parseStoredPhone(candidate.phone));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [location, setLocation] = useState(candidate.location === "—" ? "" : candidate.location);
  const [jobId, setJobId] = useState(candidate.jobId ?? "__no_job__");

  const [linkedin, setLinkedin] = useState(candidate.linkedin ?? "");
  const [portfolio, setPortfolio] = useState(candidate.portfolio ?? "");

  useEffect(() => {
    setName(candidate.name);
    setEmail(candidate.email);
    setPhone(parseStoredPhone(candidate.phone));
    setPhoneError(null);
    setLocation(candidate.location === "—" ? "" : candidate.location);
    setJobId(candidate.jobId ?? "__no_job__");
    setLinkedin(candidate.linkedin ?? "");
    setPortfolio(candidate.portfolio ?? "");
  }, [candidate]);

  const hasResume = useMemo(
    () => candidate.documents.some((d) => d.type === "resume" || d.type === "Resume"),
    [candidate.documents],
  );

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
                <p className="text-xs">{formatDayMonth(candidate.appliedDate)}</p>
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
                  onClick={onUploadDocument}
                >
                  <Icon name="Upload" className="h-3.5 w-3.5" /> Upload
                </Button>
                {hasResume && candidate.documents[0]?.id && onDeleteDocument ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
                    onClick={() => onDeleteDocument(candidate.documents[0].id as string)}
                  >
                    <Icon name="Trash2" className="h-3.5 w-3.5" /> Remove
                  </Button>
                ) : null}
              </div>
              <InputField
                label="LinkedIn"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
              />
              <InputField
                label="Portfolio"
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={savingLinks}
                  onClick={async () => {
                    try {
                      setSavingLinks(true);
                      await onSaveLinks({ linkedin, portfolio });
                      setLinksEdit(false);
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
                  onClick={() => setLinksEdit(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              {candidate.documents.slice(0, 3).map((d, i) => (
                <Button
                  key={d.id ?? i}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs w-full justify-start gap-2"
                >
                  <Icon name="ScrollText" className="h-3.5 w-3.5" />
                  <span className="truncate flex-1 text-left">{d.name}</span>
                </Button>
              ))}
              {candidate.linkedin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs w-full justify-start gap-2"
                >
                  <Icon name="Link" className="h-3.5 w-3.5" /> LinkedIn
                </Button>
              ) : null}
              {candidate.portfolio ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs w-full justify-start gap-2"
                >
                  <Icon name="Link" className="h-3.5 w-3.5" /> Portfolio
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
