"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Icon } from "@onehash/ui/icon";
import { InputField } from "@onehash/ui/input";
import { SelectField } from "@onehash/ui/select";
import { Textarea } from "@onehash/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  OverviewTab,
  InterviewsTab,
  EvaluationTab,
  DocumentsTab,
} from "@/components/candidates/tabs";
import { SummaryPanel } from "@/components/candidates/summary/SummaryPanel";
import { ActionButtons } from "@/components/candidates/components/ActionButtons";
import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import {
  addCandidateNote,
  createCandidateFeedback,
  createCandidateInterview,
  deleteCandidateDocument,
  getCandidateById,
  getJobs,
  getCandidateDocuments,
  getCandidateEvaluation,
  getCandidateInterviews,
  getCandidateOverview,
  getOrgUsers,
  updateCandidate,
  uploadCandidateDocument,
  type CandidateDetailResponse,
  type CandidateDocumentResponse,
  type CandidateEvaluationResponse,
  type CandidateInterviewResponse,
  type JobListItemResponse,
  type CandidateOverviewResponse,
  type OrgUserResponse,
} from "@/api";
import { toast } from "sonner";

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
  const date = new Date(activity.created_at).toLocaleString();

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

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("overview");
  const { t } = useTranslation();
  const id = params?.candidateId as string | undefined;
  const [candidate, setCandidate] = useState<CandidateDetailResponse | null>(null);
  const [overview, setOverview] = useState<CandidateOverviewResponse | null>(null);
  const [interviews, setInterviews] = useState<CandidateInterviewResponse[]>([]);
  const [evaluation, setEvaluation] = useState<CandidateEvaluationResponse | null>(null);
  const [documents, setDocuments] = useState<CandidateDocumentResponse[]>([]);
  const [jobs, setJobs] = useState<JobListItemResponse[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState("Technical Interview");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState("60");
  const [scheduleLink, setScheduleLink] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackInterviewId, setFeedbackInterviewId] = useState("");
  const [feedbackDecision, setFeedbackDecision] = useState("yes");
  const [feedbackRating, setFeedbackRating] = useState("4");
  const [feedbackComments, setFeedbackComments] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [documentOpen, setDocumentOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("attachment");
  const [documentLoading, setDocumentLoading] = useState(false);

  useSetPageMetadata({
    title: t("edit_candidate_title"),
    subtitle: t("edit_candidate_subtitle"),
  });

  const loadAll = async (candidateId: string) => {
    const [candidateData, overviewData, interviewsData, evaluationData, documentsData] =
      await Promise.all([
        getCandidateById(candidateId),
        getCandidateOverview(candidateId),
        getCandidateInterviews(candidateId),
        getCandidateEvaluation(candidateId),
        getCandidateDocuments(candidateId),
      ]);
    setCandidate(candidateData);
    setOverview(overviewData);
    setInterviews(interviewsData);
    setEvaluation(evaluationData);
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

    const mappedInterviews = interviews.map((i) => {
      const dt = new Date(i.scheduled_at);
      const isCompleted = dt.getTime() < Date.now();
      const feedbackForInterview = (evaluation?.feedback ?? []).find(
        (f) => f.interview_id === i.id,
      );
      return {
        id: i.id,
        title: i.title,
        date: dt.toLocaleDateString(),
        time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        interviewer: `${i.interviewer_ids.length} interviewer(s)`,
        status: isCompleted ? "Completed" : "Scheduled",
        rating: feedbackForInterview?.rating ?? null,
        decision: feedbackForInterview?.decision
          ? feedbackForInterview.decision.toUpperCase()
          : null,
        feedback: feedbackForInterview?.comments ?? null,
      };
    });

    const overall = evaluation?.average_rating ?? 0;

    return {
      name: candidate.name,
      role: candidate.job_title ?? "—",
      jobId: candidate.job_id,
      email: candidate.email,
      phone: candidate.phone ?? "—",
      location: candidate.location ?? "—",
      stage,
      source: candidate.source ?? "job_board",
      appliedDate: new Date(candidate.created_at).toLocaleDateString(),
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
      interviews: mappedInterviews,
      scores: {
        technical: overall,
        communication: overall,
        cultureFit: overall,
        overall,
      },
      notes: (overview?.notes ?? []).map((n) => ({
        user: n.author_name ?? "Unknown",
        date: new Date(n.created_at).toLocaleDateString(),
        text: n.content,
        mentions: n.mentions,
      })),
    };
  }, [candidate, overview, interviews, evaluation, documents]);

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

  const handleScheduleInterview = async () => {
    if (!id || !scheduleTitle.trim() || !scheduleAt) return;
    try {
      setScheduleLoading(true);
      await createCandidateInterview(id, {
        title: scheduleTitle.trim(),
        scheduled_at: new Date(scheduleAt).toISOString(),
        duration_minutes: Number(scheduleDuration) || undefined,
        meeting_link: scheduleLink.trim() || undefined,
        interviewer_ids: [],
      });
      setScheduleOpen(false);
      await loadAll(id);
      toast.success("Interview scheduled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule interview");
    } finally {
      setScheduleLoading(false);
    }
  };

  const openFeedbackDialog = (interviewId: string) => {
    setFeedbackInterviewId(interviewId);
    setFeedbackOpen(true);
  };

  const handleSubmitFeedback = async () => {
    if (!id || !feedbackInterviewId) return;
    try {
      setFeedbackLoading(true);
      await createCandidateFeedback(id, feedbackInterviewId, {
        decision: feedbackDecision as "yes" | "no" | "maybe",
        rating: feedbackRating ? Number(feedbackRating) : undefined,
        comments: feedbackComments.trim() || undefined,
      });
      setFeedbackOpen(false);
      setFeedbackComments("");
      await loadAll(id);
      toast.success("Feedback submitted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setFeedbackLoading(false);
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
        <Button variant="outline" size="sm" onClick={() => router.push("/candidates")}>
          <Icon name="ChevronLeft" className="h-3.5 w-3.5 mr-1.5" /> Back to Candidates
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
            <Link href="/candidates">
              <Icon name="ChevronLeft" className="h-3.5 w-3.5" /> {t("candidates")}
            </Link>
          </Button>
          <ActionButtons candidateName={uiCandidate.name} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0">
            {[
              { value: "overview", label: t("overview") },
              { value: "interviews", label: t("interviews") },
              { value: "evaluation", label: t("evaluation") },
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
                />
              </TabsContent>
              <TabsContent value="interviews" className="mt-0">
                <InterviewsTab
                  interviews={uiCandidate.interviews}
                  onScheduleInterview={() => setScheduleOpen(true)}
                  onAddFeedback={openFeedbackDialog}
                />
              </TabsContent>
              <TabsContent value="evaluation" className="mt-0">
                <EvaluationTab
                  scores={uiCandidate.scores}
                  interviews={uiCandidate.interviews}
                  decisionCounts={evaluation?.counts}
                  feedbackItems={evaluation?.feedback}
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

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>Create an interview for this candidate.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <InputField
              label="Title"
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              showAsterisk
            />
            <InputField
              label="Scheduled At"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              showAsterisk
            />
            <InputField
              label="Duration (minutes)"
              type="number"
              value={scheduleDuration}
              onChange={(e) => setScheduleDuration(e.target.value)}
            />
            <InputField
              label="Meeting Link"
              value={scheduleLink}
              onChange={(e) => setScheduleLink(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setScheduleOpen(false)}
              disabled={scheduleLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleScheduleInterview}
              disabled={scheduleLoading || !scheduleTitle.trim() || !scheduleAt}
            >
              {scheduleLoading ? "Saving..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Feedback</DialogTitle>
            <DialogDescription>Submit interview feedback for this candidate.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <SelectField
              label="Decision"
              value={feedbackDecision}
              onValueChange={setFeedbackDecision}
              options={[
                { value: "yes", label: "Yes" },
                { value: "maybe", label: "Maybe" },
                { value: "no", label: "No" },
              ]}
            />
            <SelectField
              label="Rating"
              value={feedbackRating}
              onValueChange={setFeedbackRating}
              options={[
                { value: "5", label: "5" },
                { value: "4", label: "4" },
                { value: "3", label: "3" },
                { value: "2", label: "2" },
                { value: "1", label: "1" },
              ]}
            />
            <div>
              <p className="text-sm font-medium mb-1.5">Comments</p>
              <Textarea
                className="text-sm min-h-[90px]"
                value={feedbackComments}
                onChange={(e) => setFeedbackComments(e.target.value)}
                placeholder="Share your evaluation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFeedbackOpen(false)}
              disabled={feedbackLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitFeedback}
              disabled={feedbackLoading || !feedbackInterviewId}
            >
              {feedbackLoading ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={documentOpen} onOpenChange={setDocumentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Upload a PDF document (max 1MB).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1.5">PDF File *</p>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
            </div>
            <SelectField
              label="Type"
              value={docType}
              onValueChange={setDocType}
              options={[
                { value: "attachment", label: "Attachment" },
                { value: "portfolio", label: "Portfolio" },
                { value: "certificate", label: "Certificate" },
              ]}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDocumentOpen(false)}
              disabled={documentLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUploadDocument}
              disabled={documentLoading || !docFile}
            >
              {documentLoading ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
