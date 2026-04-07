"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Icon } from "@onehash/ui/icon";
import { DocumentUploadDialog } from "@/components/candidates/shared/dialogs/DocumentUploadDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  OverviewTab,
  DocumentsTab,
  CandidateMessagesTab,
  ResumeTab,
  ApplicationResponsesTab,
} from "@/components/candidates/shared/tabs";
import { SummaryPanel } from "@/components/candidates/shared/summary/SummaryPanel";
import { ActionButtons } from "@/components/candidates/job_candidates/ActionButtons";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  getApiBase,
  addCandidateNote,
  deleteCandidateDocument,
  getCandidateById,
  getJobs,
  getJobById,
  getJobWorkspace,
  getCandidateDocuments,
  getCandidateApplicationResponses,
  getCandidateOverview,
  getOrgUsers,
  updateCandidate,
  uploadCandidateDocument,
  type CandidateDetailResponse,
  type CandidateDocumentResponse,
  type JobListItemResponse,
  type JobHiringStageResponse,
  type JobDetailResponse,
  type CandidateOverviewResponse,
  type CandidateApplicationResponsesResponse,
  type OrgUserResponse,
} from "@/api";
import { toast } from "@onehash/ui/sonner";

const toTitle = (value: string) =>
  value
    .split("_")
    .map((v) => (v ? v[0].toUpperCase() + v.slice(1) : ""))
    .join(" ");

const HIRING_TIMELINE_TYPES = new Set([
  "candidate_created",
  "stage_changed",
  "status_changed",
  "bulk_stage_changed",
  "bulk_status_changed",
]);

function toSentenceCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function mapHiringTimelineItem(activity: {
  type: string;
  created_at: string;
  created_by_name?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const metadata = activity.metadata ?? {};
  const actor = activity.created_by_name ?? "System";
  const date = activity.created_at;

  if (activity.type === "stage_changed") {
    const stageName = String(metadata.stage_name ?? "Updated");
    return { action: `Moved to ${stageName}`, user: actor, date, icon: "move" };
  }
  if (activity.type === "status_changed") {
    const status = toSentenceCase(String(metadata.status ?? "updated"));
    return { action: `Status changed to ${status}`, user: actor, date, icon: "feedback" };
  }
  if (activity.type === "candidate_created") {
    const source = String(metadata.source ?? "Manual");
    return {
      action: source === "job_portal" ? "Applied from job portal" : "Candidate added",
      user: actor,
      date,
      icon: "apply",
    };
  }
  if (activity.type === "candidate_updated") {
    if (metadata.job_changed === true) {
      const oldJobId = metadata.old_job_id;
      const newJobId = metadata.new_job_id;
      const hadJob = Boolean(oldJobId);
      const hasJob = Boolean(newJobId);
      if (!hadJob && hasJob) {
        return { action: "Job assigned", user: actor, date, icon: "move" };
      }
      if (hadJob && !hasJob) {
        return { action: "Job unassigned", user: actor, date, icon: "move" };
      }
      if (hadJob && hasJob && oldJobId !== newJobId) {
        return { action: "Job changed", user: actor, date, icon: "move" };
      }
    }
    return { action: "Candidate details updated", user: actor, date, icon: "feedback" };
  }
  if (activity.type === "bulk_stage_changed") {
    return { action: "Stage updated", user: actor, date, icon: "move" };
  }
  if (activity.type === "bulk_status_changed") {
    return { action: "Status updated", user: actor, date, icon: "feedback" };
  }
  return { action: toTitle(activity.type), user: actor, date, icon: "apply" };
}

export function JobCandidateProfile({
  candidateId: id,
  jobRouteJobId,
  isStageThreePane = false,
  onCandidateUpdated,
  onStageMoved,
}: {
  candidateId: string | undefined;
  /** When set, URL is under `/jobs/[jobId]/candidates/...` and redirects sync to `candidate.job_id`. */
  jobRouteJobId?: string;
  /** True when rendered inside the stage workspace 3-pane right panel. */
  isStageThreePane?: boolean;
  /** Optional callback for parent containers (e.g., stage workspace list refresh). */
  onCandidateUpdated?: () => void | Promise<void>;
  /** Optional callback fired after moving candidate to a new stage. */
  onStageMoved?: (stageId: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("overview");
  const { t } = useTranslation();
  const [candidate, setCandidate] = useState<CandidateDetailResponse | null>(null);
  const [overview, setOverview] = useState<CandidateOverviewResponse | null>(null);
  const [documents, setDocuments] = useState<CandidateDocumentResponse[]>([]);
  const [applicationResponses, setApplicationResponses] =
    useState<CandidateApplicationResponsesResponse | null>(null);
  const [applicationResponsesLoading, setApplicationResponsesLoading] = useState(false);
  const [applicationResponsesError, setApplicationResponsesError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobListItemResponse[]>([]);
  const [jobStages, setJobStages] = useState<JobHiringStageResponse[]>([]);
  const [jobDetail, setJobDetail] = useState<JobDetailResponse | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [documentOpen, setDocumentOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("attachment");
  const [documentLoading, setDocumentLoading] = useState(false);

  const loadAll = async (candidateId: string) => {
    const [candidateData, overviewData, documentsData, applicationResponsesData] =
      await Promise.all([
        getCandidateById(candidateId),
        getCandidateOverview(candidateId),
        getCandidateDocuments(candidateId),
        getCandidateApplicationResponses(candidateId),
      ]);
    setCandidate(candidateData);
    setOverview(overviewData);
    setDocuments(documentsData);
    setApplicationResponses(applicationResponsesData);
    setApplicationResponsesError(null);
  };

  useEffect(() => {
    if (!id) {
      setError("Candidate not found");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadAll(id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load candidate");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const usersList = await getOrgUsers();
        if (!cancelled) {
          setOrgUsers(usersList);
        }
      } catch {
        // no-op
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentJobId = jobRouteJobId ?? candidate?.job_id ?? null;
  const currentAssignment = useMemo(() => {
    if (!candidate || !currentJobId) return null;
    return (candidate.assignments ?? []).find((a) => a.job_id === currentJobId) ?? null;
  }, [candidate, currentJobId]);

  useEffect(() => {
    if (!currentJobId) {
      setJobStages([]);
      setJobDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [workspace, detail] = await Promise.all([
          getJobWorkspace(currentJobId),
          getJobById(currentJobId),
        ]);
        if (!cancelled) {
          setJobStages(workspace.stages ?? []);
          setJobDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setJobStages([]);
          setJobDetail(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentJobId]);

  const uiCandidate = useMemo(() => {
    if (!candidate) return null;
    const stage = currentAssignment?.stage_name ?? candidate.stage_name ?? "Applied";

    const timeline = (overview?.activities ?? [])
      .filter((a) => HIRING_TIMELINE_TYPES.has(a.type))
      .map((a) => mapHiringTimelineItem(a));

    return {
      name: candidate.name,
      role: currentAssignment?.job_title ?? candidate.job_title ?? "—",
      email: candidate.email,
      phone: candidate.phone ?? "—",
      address: candidate.address ?? "—",
      stage,
      source: candidate.source ?? "job_portal",
      appliedDate: candidate.created_at,
      documents: [
        ...documents.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.doc_type,
          date: new Date(d.created_at).toLocaleDateString(),
          size: d.size_label ?? "—",
          url: d.url,
        })),
      ],
      profileLinks: ((candidate.profile_links ?? {}) as Record<string, string>) || {},
      coverLetter: false,
      tags: candidate.tags ?? [],
      timeline,
      notes: (overview?.notes ?? []).map((n) => ({
        user: n.author_name ?? "Unknown",
        date: n.created_at,
        text: n.content,
        mentions: n.mentions,
      })),
    };
  }, [candidate, currentAssignment, overview, documents]);

  const resumeDoc = useMemo(() => {
    const docs = uiCandidate?.documents ?? [];
    return (
      docs.find((d) => d.type?.toLowerCase?.() === "resume") ??
      docs.find((d) => d.name?.toLowerCase?.().includes("resume")) ??
      docs[0] ??
      null
    );
  }, [uiCandidate]);

  const handleAddNote = async (content: string, mentions: string[]) => {
    if (!id) return;
    try {
      await addCandidateNote(id, { content, mentions });
      const ov = await getCandidateOverview(id);
      setOverview(ov);
      toast.success("Note added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
      throw err;
    }
  };

  const handleUploadDocument = async () => {
    if (!id || !docFile) return;
    try {
      setDocumentLoading(true);
      await uploadCandidateDocument(id, docFile, docType);
      setDocumentOpen(false);
      setDocFile(null);
      await loadAll(id);
      toast.success("Document uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setDocumentLoading(false);
    }
  };

  const handleReplaceResume = async (file: File) => {
    if (!id) return;
    try {
      const existingResumeDocs = documents.filter(
        (d) => d.doc_type?.toLowerCase() === "resume" || d.name?.toLowerCase().includes("resume"),
      );
      const uploaded = await uploadCandidateDocument(id, file, "resume", "resume", "Resume");
      for (const doc of existingResumeDocs) {
        if (doc.id !== uploaded.id) {
          await deleteCandidateDocument(id, doc.id);
        }
      }
      await loadAll(id);
      toast.success("Resume updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update resume");
      throw err;
    }
  };

  const handleRemoveResume = async () => {
    if (!id) return;
    const currentResume = documents.find(
      (d) => d.doc_type?.toLowerCase() === "resume" || d.name?.toLowerCase().includes("resume"),
    );
    if (!currentResume?.id) return;
    try {
      await deleteCandidateDocument(id, currentResume.id);
      await loadAll(id);
      toast.success("Resume removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove resume");
      throw err;
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!id) return;
    try {
      await deleteCandidateDocument(id, documentId);
      await loadAll(id);
      toast.success("Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const handleSaveSummaryProfile = async (payload: {
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
  }) => {
    if (!id) return;
    try {
      await updateCandidate(id, payload);
      await loadAll(id);
      toast.success("Candidate updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update candidate");
    }
  };

  const handleSaveSummaryLinks = async (payload: Record<string, string>) => {
    if (!id || !candidate) return;
    try {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(payload || {})) {
        const cleanKey = key.trim();
        const cleanValue = String(value ?? "").trim();
        if (!cleanKey || !cleanValue) continue;
        normalized[cleanKey] = cleanValue;
      }
      await updateCandidate(id, {
        profile_links: normalized,
      });
      await loadAll(id);
      toast.success("Links updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update links");
    }
  };

  const loadApplicationResponses = async (candidateId: string) => {
    try {
      setApplicationResponsesLoading(true);
      setApplicationResponsesError(null);
      const data = await getCandidateApplicationResponses(candidateId);
      setApplicationResponses(data);
    } catch (err) {
      setApplicationResponsesError(
        err instanceof Error ? err.message : "Failed to load application responses",
      );
    } finally {
      setApplicationResponsesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "application_responses") return;
    if (applicationResponses?.has_additional_questions) return;
    setActiveTab("overview");
  }, [activeTab, applicationResponses?.has_additional_questions]);

  const hasAdditionalQuestions = applicationResponses?.has_additional_questions ?? false;
  const profileLinkFields = useMemo(() => {
    const schema = (jobDetail?.application_form_schema ?? {}) as Record<string, unknown>;
    const raw = Array.isArray(schema.profile_links)
      ? (schema.profile_links as Array<Record<string, unknown>>)
      : [];
    const mapped = raw
      .map((field) => {
        const visibility = String(field.visibility ?? "hidden").toLowerCase();
        if (visibility === "hidden") return null;
        const sourceKey = String(field.key ?? field.id ?? "").trim();
        if (!sourceKey) return null;
        const key = sourceKey.startsWith("profile_link_")
          ? sourceKey.replace("profile_link_", "")
          : sourceKey;
        const label = String(field.label ?? key).trim() || key;
        return {
          key,
          label,
          required: visibility === "required",
        };
      })
      .filter((item): item is { key: string; label: string; required: boolean } => Boolean(item));
    return mapped;
  }, [jobDetail?.application_form_schema]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading candidate...</p>;
  }

  if (error || !uiCandidate) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-muted-foreground">{error ?? "Candidate not found"}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            jobRouteJobId
              ? router.push(`/jobs/${encodeURIComponent(jobRouteJobId)}`)
              : router.push("/candidates")
          }
        >
          <Icon name="ChevronLeft" className="h-3.5 w-3.5 mr-1.5" />{" "}
          {jobRouteJobId ? "Back to job" : t("candidates_title")}
        </Button>
      </div>
    );
  }

  const sourceBadgeLabel =
    uiCandidate.source === "Manual"
      ? "Manually Added"
      : uiCandidate.source === "email_automation"
        ? "Email Automation"
        : uiCandidate.source === "job_portal"
          ? "Job Portal"
          : toTitle(uiCandidate.source).replaceAll("_", " ");

  return (
    <>
      <div className="space-y-4">
        <div
          className={cn(
            "flex items-center justify-between gap-2",
            isStageThreePane && isMobile && "px-3",
          )}
        >
          {isStageThreePane ? (
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-medium truncate">{uiCandidate.name}</p>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
              <Link
                href={
                  jobRouteJobId && (currentAssignment?.stage_id ?? candidate?.stage_id)
                    ? `/jobs/${encodeURIComponent(jobRouteJobId)}/stage/${encodeURIComponent(currentAssignment?.stage_id ?? candidate?.stage_id ?? "")}`
                    : jobRouteJobId
                      ? `/jobs/${encodeURIComponent(jobRouteJobId)}`
                      : "/candidates"
                }
              >
                <Icon name="ChevronLeft" className="h-3.5 w-3.5" />{" "}
                {jobRouteJobId ? "Job" : t("candidates_title")}
              </Link>
            </Button>
          )}
          <ActionButtons
            candidateName={uiCandidate.name}
            candidateId={candidate!.id}
            jobId={jobRouteJobId ?? candidate?.job_id ?? undefined}
            currentStageId={currentAssignment?.stage_id ?? candidate?.stage_id}
            stages={jobStages}
            onCandidateUpdated={async () => {
              if (id) await loadAll(id);
              if (onCandidateUpdated) await onCandidateUpdated();
            }}
            onStageMoved={onStageMoved}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className={cn(
              "h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0",
              isStageThreePane && isMobile && "px-3",
            )}
          >
            {[
              { value: "overview", label: t("overview") },
              { value: "messages", label: t("messages") },
              { value: "documents", label: t("documents") },
              ...(hasAdditionalQuestions
                ? [{ value: "application_responses", label: "Application Responses" }]
                : []),
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-9 px-3"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div
            className={cn(
              "mt-4 min-w-0 overflow-x-hidden",
              isMobile ? "space-y-4" : "grid grid-cols-[1fr_320px] gap-4",
              isStageThreePane && isMobile && "px-0",
            )}
          >
            <div className="min-w-0 overflow-x-hidden">
              <TabsContent value="overview" className={`mt-0 ${isMobile ? "space-y-4" : ""}`}>
                {isStageThreePane ? (
                  <div className="space-y-4">
                    <ResumeTab
                      resumeUrl={resumeDoc?.url ?? null}
                      previewUrl={
                        id && resumeDoc?.id
                          ? `${getApiBase()}/v1/internal/candidates/${encodeURIComponent(id)}/documents/${encodeURIComponent(
                              resumeDoc.id,
                            )}/preview`
                          : null
                      }
                      resumeName={resumeDoc?.name ?? null}
                      onUploadResumeFile={handleReplaceResume}
                    />
                    <OverviewTab
                      timeline={[]}
                      notes={uiCandidate.notes}
                      mentionableUsers={orgUsers}
                      onAddNote={handleAddNote}
                      showTimeline={false}
                    />
                  </div>
                ) : (
                  <OverviewTab
                    timeline={uiCandidate.timeline}
                    notes={uiCandidate.notes}
                    mentionableUsers={orgUsers}
                    onAddNote={handleAddNote}
                    timelineTitle="Hiring Status Timeline"
                    timelineEmptyText="No hiring status updates yet."
                  />
                )}
              </TabsContent>
              <TabsContent value="messages" className="mt-0">
                <CandidateMessagesTab
                  candidateId={candidate!.id}
                  candidateName={uiCandidate.name}
                  candidateEmail={candidate!.email}
                  jobId={jobRouteJobId ?? candidate?.job_id ?? null}
                  jobTitle={currentAssignment?.job_title ?? candidate?.job_title ?? null}
                />
              </TabsContent>
              <TabsContent value="documents" className="mt-0">
                <DocumentsTab
                  documents={uiCandidate.documents}
                  onUploadDocument={() => setDocumentOpen(true)}
                  onDeleteDocument={handleDeleteDocument}
                />
              </TabsContent>
              {hasAdditionalQuestions ? (
                <TabsContent value="application_responses" className="mt-0">
                  <ApplicationResponsesTab
                    loading={applicationResponsesLoading}
                    error={applicationResponsesError}
                    submittedAt={applicationResponses?.submitted_at ?? null}
                    items={applicationResponses?.items ?? []}
                    onRetry={() => {
                      if (!id) return;
                      void loadApplicationResponses(id);
                    }}
                  />
                </TabsContent>
              ) : null}
            </div>
            <SummaryPanel
              variant="job"
              candidate={uiCandidate}
              timeline={uiCandidate.timeline}
              onSaveProfile={handleSaveSummaryProfile}
              onSaveLinks={handleSaveSummaryLinks}
              onReplaceResume={handleReplaceResume}
              onRemoveResume={handleRemoveResume}
              profileLinkFields={profileLinkFields}
            />
          </div>
        </Tabs>
      </div>

      <DocumentUploadDialog
        open={documentOpen}
        onOpenChange={setDocumentOpen}
        docFile={docFile}
        onDocFileChange={setDocFile}
        docType={docType}
        onDocTypeChange={setDocType}
        loading={documentLoading}
        onUpload={handleUploadDocument}
      />
    </>
  );
}
