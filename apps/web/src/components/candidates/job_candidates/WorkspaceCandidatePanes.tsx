"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { toast } from "@onehash/ui/sonner";
import { ActionButtons } from "./ActionButtons";
import {
  OverviewTab,
  InterviewsTab,
  EvaluationTab,
  DocumentsTab,
} from "@/components/candidates/shared/tabs";
import {
  addCandidateNote,
  deleteCandidateDocument,
  getCandidateById,
  getCandidateDocuments,
  getCandidateEvaluation,
  getCandidateInterviews,
  getCandidateOverview,
  getOrgUsers,
  type CandidateDetailResponse,
  type CandidateDocumentResponse,
  type CandidateEvaluationResponse,
  type CandidateInterviewResponse,
  type CandidateOverviewResponse,
  type OrgUserResponse,
} from "@/api";

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
  return { action: "Candidate updated", user: actor, date, icon: "feedback" };
}

export function WorkspaceCandidatePanes({
  candidateId,
  jobId,
  onCandidateUpdated,
  onClose,
}: {
  candidateId: string;
  jobId: string;
  onCandidateUpdated?: () => void | Promise<void>;
  onClose?: () => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [candidate, setCandidate] = useState<CandidateDetailResponse | null>(null);
  const [overview, setOverview] = useState<CandidateOverviewResponse | null>(null);
  const [interviews, setInterviews] = useState<CandidateInterviewResponse[]>([]);
  const [evaluation, setEvaluation] = useState<CandidateEvaluationResponse | null>(null);
  const [documents, setDocuments] = useState<CandidateDocumentResponse[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUserResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async (id: string) => {
    const [candidateData, overviewData, interviewsData, evaluationData, documentsData] =
      await Promise.all([
        getCandidateById(id),
        getCandidateOverview(id),
        getCandidateInterviews(id),
        getCandidateEvaluation(id),
        getCandidateDocuments(id),
      ]);
    setCandidate(candidateData);
    setOverview(overviewData);
    setInterviews(interviewsData);
    setEvaluation(evaluationData);
    setDocuments(documentsData);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadAll(candidateId);
      } catch {
        if (!cancelled) toast.error("Failed to load candidate");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const users = await getOrgUsers();
        if (!cancelled) setOrgUsers(users);
      } catch {
        // no-op
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const notifyUpdated = () => {
    if (!onCandidateUpdated) return;
    void Promise.resolve(onCandidateUpdated());
  };

  const uiCandidate = useMemo(() => {
    if (!candidate) return null;
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
        decision: feedbackForInterview?.decision?.toUpperCase() ?? null,
        feedback: feedbackForInterview?.comments ?? null,
      };
    });
    const overall = evaluation?.average_rating ?? 0;
    return {
      name: candidate.name,
      role: candidate.job_title ?? "—",
      email: candidate.email,
      stage: candidate.stage_name ?? "Applied",
      timeline,
      interviews: mappedInterviews,
      notes: (overview?.notes ?? []).map((n) => ({
        user: n.author_name ?? "Unknown",
        date: new Date(n.created_at).toLocaleDateString(),
        text: n.content,
        mentions: n.mentions,
      })),
      documents: documents.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.doc_type,
        date: new Date(d.created_at).toLocaleDateString(),
        size: d.size_label ?? "—",
        url: d.url,
      })),
      scores: {
        technical: overall,
        communication: overall,
        cultureFit: overall,
        overall,
      },
    };
  }, [candidate, overview, interviews, evaluation, documents]);

  const handleAddNote = async (content: string, mentions: string[]) => {
    await addCandidateNote(candidateId, { content, mentions });
    const ov = await getCandidateOverview(candidateId);
    setOverview(ov);
    notifyUpdated();
  };

  if (loading || !uiCandidate) {
    return (
      <section className="flex-1 grid place-items-center text-sm text-muted-foreground">
        Loading...
      </section>
    );
  }

  return (
    <>
      <section className="w-[320px] border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-2xl font-semibold truncate">{uiCandidate.name}</p>
            <p className="text-xs text-muted-foreground truncate">{uiCandidate.email}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <Icon name="X" className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 border-b border-border">
          <div className="space-y-1.5">
            {[
              { id: "overview", label: "Overview", icon: "ClipboardList" },
              { id: "interviews", label: "Interviews", icon: "CalendarClock" },
              { id: "evaluation", label: "Evaluation", icon: "BadgeCheck" },
              { id: "documents", label: "Files", icon: "FileText" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full h-8 px-2 rounded-md text-xs flex items-center gap-2 ${
                  activeTab === item.id ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}
              >
                <Icon name={item.icon} className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 mt-auto border-t border-border">
          <ActionButtons candidateName={uiCandidate.name} jobId={jobId} />
        </div>
      </section>

      <section className="flex-1 min-w-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <p className="text-3xl font-semibold capitalize">{activeTab}</p>
            <TabsList className="h-8">
              <TabsTrigger value="overview" className="text-xs">
                Overview
              </TabsTrigger>
              <TabsTrigger value="interviews" className="text-xs">
                Interviews
              </TabsTrigger>
              <TabsTrigger value="evaluation" className="text-xs">
                Evaluation
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">
                Files
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="p-3 overflow-auto flex-1">
            <TabsContent value="overview" className="mt-0">
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
                onScheduleInterview={() =>
                  toast.message("Use candidate page to schedule interview")
                }
                onAddFeedback={() => toast.message("Use candidate page to add feedback")}
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
                onUploadDocument={() => toast.message("Use candidate page to upload a document")}
                onDeleteDocument={async (documentId) => {
                  await deleteCandidateDocument(candidateId, documentId);
                  await loadAll(candidateId);
                  notifyUpdated();
                }}
              />
            </TabsContent>
          </div>
        </Tabs>
      </section>
    </>
  );
}
