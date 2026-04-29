"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Icon } from "@onehash/ui/icon";
import { SelectField } from "@onehash/ui/select";
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
  DocumentsTab,
  CandidateMessagesTab,
  ResumeTab,
} from "@/components/candidates/shared/tabs";
import { SummaryPanel } from "@/components/candidates/shared/summary/SummaryPanel";
import { DocumentUploadDialog } from "@/components/candidates/shared/dialogs/DocumentUploadDialog";
import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import {
  getApiBase,
  addCandidateNote,
  deleteCandidateDocument,
  getCandidateById,
  getCandidateDocuments,
  getCandidateOverview,
  getJobs,
  getOrgUsers,
  updateCandidate,
  uploadCandidateDocument,
  type CandidateDetailResponse,
  type CandidateDocumentResponse,
  type CandidateOverviewResponse,
  type JobListItemResponse,
  type OrgUserResponse,
} from "@/api";
import { toast } from "@onehash/ui/sonner";
import { mapCandidateBase } from "@/lib/resume-insights";

export function StandaloneCandidateProfile({
  candidateId: id,
}: {
  candidateId: string | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const [documentOpen, setDocumentOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("attachment");
  const [documentLoading, setDocumentLoading] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignJobId, setAssignJobId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  useSetPageMetadata({
    title: t("candidates_profile_edit_title"),
    subtitle: t("candidates_profile_edit_subtitle"),
  });

  const loadCore = async (candidateId: string) => {
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
      setError(t("candidate_not_found"));
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadCore(id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

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
    const primaryAssignment = candidate.assignments?.[0];

    return {
      ...mapCandidateBase(candidate, documents, overview),
      role: candidate.job_title ?? primaryAssignment?.job_title ?? "—",
      stage: candidate.stage_name ?? primaryAssignment?.stage_name ?? "Applied",
      coverLetter: false,
    };
  }, [candidate, overview, documents]);

  const resumeDoc = useMemo(() => {
    if (!uiCandidate) return null;
    const docs = uiCandidate.documents ?? [];
    return (
      docs.find((d) => d.type?.toLowerCase?.() === "resume") ??
      docs.find((d) => d.name?.toLowerCase?.().includes("resume")) ??
      docs[0] ??
      null
    );
  }, [uiCandidate]);

  // Exclude every job the candidate is already actively assigned to.
  const assignableJobs = useMemo(() => {
    const assignedJobIds = new Set(
      (candidate?.assignments ?? [])
        .filter((a) => a.assignment_status === "active")
        .map((a) => a.job_id),
    );
    return jobs.filter((j) => j.status === "open" && !assignedJobIds.has(j.id));
  }, [jobs, candidate]);

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
      await loadCore(id);
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
      await loadCore(id);
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
      await loadCore(id);
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
      await loadCore(id);
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
      await loadCore(id);
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
      await loadCore(id);
      toast.success("Links updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update links");
    }
  };

  const allowedTabs = useMemo(() => new Set(["overview", "messages", "documents"]), []);

  const setActiveTabWithUrl = (tab: string) => {
    if (!allowedTabs.has(tab)) return;
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    const tab = searchParams.get("tab") || "overview";
    if (!allowedTabs.has(tab) || tab === activeTab) return;
    setActiveTab(tab);
  }, [activeTab, allowedTabs, searchParams]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("loading_candidate")}</p>;
  }

  if (error || !uiCandidate) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-muted-foreground">{error ?? t("candidate_not_found")}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/candidates")}>
          <Icon name="ChevronLeft" className="h-3.5 w-3.5 mr-1.5" /> {t("candidates_title")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTabWithUrl}>
        {/* Sticky header: back/assign row + tab list */}
        <div className="sticky top-0 z-10 bg-background -mt-4 md:-mt-6 pt-4 md:pt-6 space-y-3">
          <div className="flex w-full min-w-0 items-center justify-between gap-3">
            <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs gap-1.5" asChild>
              <Link href="/candidates">
                <Icon name="ChevronLeft" className="h-3.5 w-3.5" /> {t("candidates_title")}
              </Link>
            </Button>
            {assignableJobs.length > 0 ? (
              <Button
                type="button"
                size="sm"
                className="h-9 md:h-8 shrink-0 gap-2 rounded-md px-4 text-xs font-medium"
                onClick={() => {
                  setAssignJobId(assignableJobs[0]?.id ?? "");
                  setAssignOpen(true);
                }}
              >
                <Icon name="UserCheck" className="h-4 w-4" />
                {t("assign_job")}
              </Button>
            ) : null}
          </div>

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
        </div>

        {/* Scrollable tab content */}
        <div
          className={`mt-4 min-w-0 overflow-x-hidden ${isMobile ? "space-y-4" : "grid grid-cols-[1fr_320px] gap-4"}`}
        >
          <div className="min-w-0 overflow-x-hidden">
            <TabsContent
              value="overview"
              className={`mt-0 space-y-4 ${isMobile ? "space-y-4" : ""}`}
            >
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
            </TabsContent>
            <TabsContent value="messages" className="mt-0">
              <CandidateMessagesTab
                candidateId={candidate!.id}
                candidateName={uiCandidate.name}
                candidateEmail={candidate!.email}
                jobId={candidate?.job_id ?? null}
                jobTitle={candidate?.job_title ?? null}
              />
            </TabsContent>
            <TabsContent value="documents" className="mt-0">
              <DocumentsTab
                candidateId={id}
                documents={uiCandidate.documents}
                onUploadDocument={() => setDocumentOpen(true)}
                onDeleteDocument={handleDeleteDocument}
              />
            </TabsContent>
          </div>
          <SummaryPanel
            variant="standalone"
            candidate={uiCandidate}
            onSaveProfile={handleSaveSummaryProfile}
            onSaveLinks={handleSaveSummaryLinks}
            onReplaceResume={handleReplaceResume}
            onRemoveResume={handleRemoveResume}
          />
        </div>
      </Tabs>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("assign_job")}</DialogTitle>
            <DialogDescription>{t("assign_job_description")}</DialogDescription>
          </DialogHeader>
          <SelectField
            label={t("jobs_title")}
            value={assignJobId}
            onValueChange={setAssignJobId}
            options={assignableJobs.map((j) => ({ value: j.id, label: j.title }))}
          />
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setAssignOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={assignLoading || !assignJobId}
              pending={assignLoading}
              onClick={async () => {
                if (!id) return;
                if (!assignJobId) {
                  toast.error(t("select_a_job"));
                  return;
                }
                if (assignJobId === candidate?.job_id) {
                  return;
                }
                try {
                  setAssignLoading(true);
                  await updateCandidate(id, { job_id: assignJobId });
                  setAssignOpen(false);
                  toast.success(t("assigned_to_job"));
                  router.push(
                    `/jobs/${encodeURIComponent(assignJobId)}/candidates/${encodeURIComponent(id)}`,
                  );
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t("error"));
                } finally {
                  setAssignLoading(false);
                }
              }}
            >
              {t("assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
