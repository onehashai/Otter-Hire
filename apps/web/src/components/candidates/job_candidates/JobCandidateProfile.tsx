"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Icon } from "@onehash/ui/icon";
import { DocumentUploadDialog } from "@/components/candidates/shared/dialogs/DocumentUploadDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { OverviewTab, DocumentsTab, CandidateMessagesTab } from "@/components/candidates/shared/tabs";
import { SummaryPanel } from "@/components/candidates/shared/summary/SummaryPanel";
import { ActionButtons } from "@/components/candidates/job_candidates/ActionButtons";
import { MoveStageDialog } from "@/components/candidates/job_candidates/MoveStageDialog";
import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import {
  addCandidateNote,
  deleteCandidateDocument,
  getCandidateById,
  getJobs,
  getCandidateDocuments,
  getCandidateOverview,
  getOrgUsers,
  updateCandidate,
  uploadCandidateDocument,
  type CandidateDetailResponse,
  type CandidateDocumentResponse,
  type JobListItemResponse,
  type CandidateOverviewResponse,
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
  "candidate_updated",
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
    const source = String(metadata.source ?? "manual");
    return {
      action: source === "job_board" ? "Applied from job board" : "Candidate added",
      user: actor,
      date,
      icon: "apply",
    };
  }
  if (activity.type === "candidate_updated") {
    if ("job_id" in metadata) {
      const hasJob = Boolean(metadata.job_id);
      return {
        action: hasJob ? "Job assigned" : "Job unassigned",
        user: actor,
        date,
        icon: "move",
      };
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
}: {
  candidateId: string | undefined;
  /** When set, URL is under `/jobs/[jobId]/candidates/...` and redirects sync to `candidate.job_id`. */
  jobRouteJobId?: string;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("overview");
  const { t } = useTranslation();
  const [candidate, setCandidate] = useState<CandidateDetailResponse | null>(null);
  const [overview, setOverview] = useState<CandidateOverviewResponse | null>(null);
  const [documents, setDocuments] = useState<CandidateDocumentResponse[]>([]);
  const [jobs, setJobs] = useState<JobListItemResponse[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moveStageOpen, setMoveStageOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("attachment");
  const [documentLoading, setDocumentLoading] = useState(false);

  useSetPageMetadata({
    title: t("job_candidate_edit_title"),
    subtitle: t("job_candidate_edit_subtitle"),
  });

  const loadAll = async (candidateId: string) => {
    const [candidateData, overviewData, documentsData] = await Promise.all([
      getCandidateById(candidateId),
      getCandidateOverview(candidateId),
      getCandidateDocuments(candidateId),
    ]);
    setCandidate(candidateData);
    setOverview(overviewData);
    setDocuments(documentsData);
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
    if (!candidate || !jobRouteJobId || !id) return;
    const cid = candidate.job_id;
    if (cid && cid !== jobRouteJobId) {
      router.replace(`/jobs/${encodeURIComponent(cid)}/candidates/${encodeURIComponent(id)}`);
    }
  }, [candidate, jobRouteJobId, id, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [jobsList, usersList] = await Promise.all([getJobs(), getOrgUsers()]);
        if (!cancelled) {
          setJobs(jobsList);
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

  const uiCandidate = useMemo(() => {
    if (!candidate) return null;
    const stage =
      candidate.status === "rejected"
        ? "Rejected"
        : candidate.status === "hired"
          ? "Hired"
          : (candidate.stage_name ?? "Applied");

    const timeline = (overview?.activities ?? [])
      .filter((a) => HIRING_TIMELINE_TYPES.has(a.type))
      .map((a) => mapHiringTimelineItem(a));

    return {
      name: candidate.name,
      role: candidate.job_title ?? "—",
      jobId: candidate.job_id,
      email: candidate.email,
      phone: candidate.phone ?? "—",
      location: candidate.location ?? "—",
      stage,
      source: candidate.source ?? "job_board",
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
      linkedin: candidate.profile_links?.linkedin,
      portfolio: candidate.profile_links?.portfolio,
      coverLetter: false,
      tags: candidate.tags ?? [],
      timeline,
      notes: (overview?.notes ?? []).map((n) => ({
        user: n.author_name ?? "Unknown",
        date: new Date(n.created_at).toLocaleDateString(),
        text: n.content,
        mentions: n.mentions,
      })),
    };
  }, [candidate, overview, documents]);

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
    location: string | null;
    job_id?: string | null;
    clear_job?: boolean;
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

  const handleOpenMoveStage = () => {
    const jid = jobRouteJobId ?? candidate?.job_id;
    if (!jid) {
      toast.error("This candidate is not assigned to a job. Please assign a job first.");
      return;
    }
    setMoveStageOpen(true);
  };

  const handleSaveSummaryLinks = async (payload: { linkedin?: string; portfolio?: string }) => {
    if (!id || !candidate) return;
    try {
      await updateCandidate(id, {
        profile_links: {
          ...((candidate.profile_links ?? {}) as Record<string, string>),
          linkedin: payload.linkedin?.trim() ?? "",
          portfolio: payload.portfolio?.trim() ?? "",
        },
      });
      await loadAll(id);
      toast.success("Links updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update links");
    }
  };

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
              : router.push("/talent-pool")
          }
        >
          <Icon name="ChevronLeft" className="h-3.5 w-3.5 mr-1.5" />{" "}
          {jobRouteJobId ? "Back to job" : t("talent_pool_title")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
            <Link
              href={
                jobRouteJobId && candidate?.stage_id
                  ? `/jobs/${encodeURIComponent(jobRouteJobId)}/stage/${encodeURIComponent(candidate.stage_id)}`
                  : jobRouteJobId
                    ? `/jobs/${encodeURIComponent(jobRouteJobId)}`
                    : "/talent-pool"
              }
            >
              <Icon name="ChevronLeft" className="h-3.5 w-3.5" />{" "}
              {jobRouteJobId ? "Job" : t("talent_pool_title")}
            </Link>
          </Button>
          <ActionButtons
            candidateName={uiCandidate.name}
            candidateId={candidate!.id}
            candidateStatus={candidate!.status}
            jobId={jobRouteJobId ?? candidate?.job_id ?? undefined}
            onStageUpdated={() => {
              if (id) void loadAll(id);
            }}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0">
            {[
              { value: "overview", label: t("overview") },
              { value: "messages", label: t("messages") },
              { value: "documents", label: t("documents") },
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

          <div className={`mt-4 ${isMobile ? "space-y-4" : "grid grid-cols-[1fr_320px] gap-4"}`}>
            <div>
              <TabsContent value="overview" className={`mt-0 ${isMobile ? "space-y-4" : ""}`}>
                <OverviewTab
                  timeline={uiCandidate.timeline}
                  notes={uiCandidate.notes}
                  mentionableUsers={orgUsers}
                  onAddNote={handleAddNote}
                  timelineTitle="Hiring Status Timeline"
                  timelineEmptyText="No hiring status updates yet."
                  timelineFirstRowAction={
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleOpenMoveStage}
                    >
                      <Icon name="UserCheck" className="h-3 w-3" /> Move Stage
                    </Button>
                  }
                />
              </TabsContent>
              <TabsContent value="messages" className="mt-0">
                <CandidateMessagesTab
                  candidateId={candidate!.id}
                  candidateName={uiCandidate.name}
                  candidateEmail={candidate!.email}
                  jobId={jobRouteJobId ?? candidate?.job_id ?? null}
                  jobTitle={candidate?.job_title ?? null}
                />
              </TabsContent>
              <TabsContent value="documents" className="mt-0">
                <DocumentsTab
                  documents={uiCandidate.documents}
                  onUploadDocument={() => setDocumentOpen(true)}
                  onDeleteDocument={handleDeleteDocument}
                />
              </TabsContent>
            </div>
            <SummaryPanel
              variant="job"
              candidate={uiCandidate}
              jobs={jobs.map((j) => ({ id: j.id, title: j.title }))}
              onSaveProfile={handleSaveSummaryProfile}
              onSaveLinks={handleSaveSummaryLinks}
              onUploadDocument={() => setDocumentOpen(true)}
              onDeleteDocument={handleDeleteDocument}
            />
          </div>
        </Tabs>
      </div>

      <MoveStageDialog
        open={moveStageOpen}
        onOpenChange={setMoveStageOpen}
        candidateId={candidate!.id}
        candidateName={uiCandidate.name}
        jobId={jobRouteJobId ?? candidate?.job_id ?? null}
        currentStageId={candidate?.stage_id ?? null}
        onSuccess={() => {
          if (id) void loadAll(id);
        }}
      />

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
