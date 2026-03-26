"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Icon } from "@onehash/ui/icon";
import { useIsMobile } from "@/hooks/use-mobile";
import { OverviewTab, DocumentsTab, CandidateMessagesTab } from "@/components/candidates/shared/tabs";
import { SummaryPanel } from "@/components/candidates/shared/summary/SummaryPanel";
import { DocumentUploadDialog } from "@/components/candidates/shared/dialogs/DocumentUploadDialog";
import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import {
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

export function TalentPoolCandidateProfile({
  candidateId: id,
}: {
  candidateId: string | undefined;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("notes");
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

  useSetPageMetadata({
    title: t("talent_pool_candidate_edit_title"),
    subtitle: t("talent_pool_candidate_edit_subtitle"),
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
      setError("Candidate not found");
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
      documents: documents.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.doc_type,
        date: new Date(d.created_at).toLocaleDateString(),
        size: d.size_label ?? "—",
        url: d.url,
      })),
      linkedin: candidate.profile_links?.linkedin,
      portfolio: candidate.profile_links?.portfolio,
      coverLetter: false,
      tags: candidate.tags ?? [],
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
      await loadCore(id);
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
    location: string | null;
    job_id?: string | null;
    clear_job?: boolean;
  }) => {
    if (!id) return;
    try {
      await updateCandidate(id, payload);
      await loadCore(id);
      toast.success("Candidate updated");
      if (payload.job_id && !payload.clear_job) {
        router.push(
          `/jobs/${encodeURIComponent(payload.job_id)}/candidates/${encodeURIComponent(id)}`,
        );
      }
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
      await loadCore(id);
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
        <Button variant="outline" size="sm" onClick={() => router.push("/talent-pool")}>
          <Icon name="ChevronLeft" className="h-3.5 w-3.5 mr-1.5" /> {t("talent_pool_title")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
            <Link href="/talent-pool">
              <Icon name="ChevronLeft" className="h-3.5 w-3.5" /> {t("talent_pool_title")}
            </Link>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0">
            {[
              { value: "notes", label: t("notes") },
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
              <TabsContent value="notes" className={`mt-0 ${isMobile ? "space-y-4" : ""}`}>
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
                  documents={uiCandidate.documents}
                  onUploadDocument={() => setDocumentOpen(true)}
                  onDeleteDocument={handleDeleteDocument}
                />
              </TabsContent>
            </div>
            <SummaryPanel
              variant="talent_pool"
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
