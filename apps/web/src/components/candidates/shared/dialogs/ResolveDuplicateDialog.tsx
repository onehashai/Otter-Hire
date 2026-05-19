"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import { Badge } from "@onehash/ui/badge";
import { toast } from "@onehash/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import {
  getCandidateById,
  resolveCandidateMerge,
  resolveCandidateKeep,
  getCandidateDocuments,
  type CandidateListItemResponse,
  type CandidateDetailResponse,
  type CandidateDocumentResponse,
} from "@/api";

type ResolveDuplicateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateListItemResponse | null;
  onResolved: () => void | Promise<void>;
};

export function ResolveDuplicateDialog({
  open,
  onOpenChange,
  candidate,
  onResolved,
}: ResolveDuplicateDialogProps) {
  const { t } = useTranslation();
  const [existingCandidate, setExistingCandidate] = useState<CandidateDetailResponse | null>(null);
  const [tempCandidate, setTempCandidate] = useState<CandidateDetailResponse | null>(null);
  const [existingDocs, setExistingDocs] = useState<CandidateDocumentResponse[]>([]);
  const [tempDocs, setTempDocs] = useState<CandidateDocumentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !candidate) {
      setExistingCandidate(null);
      setTempCandidate(null);
      setExistingDocs([]);
      setTempDocs([]);
      return;
    }

    const loadDetails = async () => {
      setLoading(true);
      try {
        const [tempDetail, existingDetail, tempDocsList, existingDocsList] = await Promise.all([
          getCandidateById(candidate.id),
          candidate.possible_duplicate_of_id
            ? getCandidateById(candidate.possible_duplicate_of_id)
            : Promise.resolve(null),
          getCandidateDocuments(candidate.id),
          candidate.possible_duplicate_of_id
            ? getCandidateDocuments(candidate.possible_duplicate_of_id)
            : Promise.resolve([]),
        ]);
        setTempCandidate(tempDetail);
        setExistingCandidate(existingDetail);
        setTempDocs(tempDocsList || []);
        setExistingDocs(existingDocsList || []);
      } catch (err) {
        toast.error("Failed to load candidate profile details for comparison");
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    };

    void loadDetails();
  }, [open, candidate, onOpenChange]);

  const handleMerge = async () => {
    if (!candidate) return;
    setSubmitting(true);
    try {
      const res = await resolveCandidateMerge(candidate.id);
      toast.success(res.message || "Candidates merged successfully");
      onOpenChange(false);
      await onResolved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to merge candidates");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeep = async () => {
    if (!candidate) return;
    setSubmitting(true);
    try {
      const res = await resolveCandidateKeep(candidate.id);
      toast.success(res.message || "Candidate registered as a separate profile");
      onOpenChange(false);
      await onResolved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to keep candidate separate");
    } finally {
      setSubmitting(false);
    }
  };

  const isDifferent = (val1: string | null | undefined, val2: string | null | undefined) => {
    const clean1 = (val1 || "").trim().toLowerCase();
    const clean2 = (val2 || "").trim().toLowerCase();
    return clean1 !== clean2 && clean1 !== "" && clean2 !== "";
  };

  const isAddition = (
    existingVal: string | null | undefined,
    newVal: string | null | undefined,
  ) => {
    return (!existingVal || existingVal.trim() === "") && newVal && newVal.trim() !== "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[95vh] flex flex-col rounded-xl p-6 border border-border bg-card shadow-2xl overflow-hidden">
        <DialogHeader className="mb-2 shrink-0">
          <div className="flex items-center gap-2 text-amber-500">
            <Icon name="CircleAlert" className="h-5 w-5 animate-pulse" />
            <DialogTitle className="text-xl font-bold tracking-tight">
              Compare Resumes & Resolve Duplicate
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Compare both candidate resumes side-by-side to decide which profile should be kept.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 flex-1">
            <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground font-medium animate-pulse">
              Loading and aligning candidate resumes...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-2 flex-1 overflow-y-auto px-1">
            {/* Profile A (Original Profile) Viewer */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 flex flex-col gap-3 shadow-sm relative overflow-hidden h-[420px] md:h-[500px] shrink-0">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h4 className="text-base font-bold tracking-tight text-foreground truncate max-w-[220px]">
                    {existingCandidate?.name || "Original Profile"}
                  </h4>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Profile A &bull; Original Profile
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shadow-sm whitespace-nowrap shrink-0"
                >
                  Original
                </Badge>
              </div>

              <div className="flex-1 rounded-lg border border-border bg-card/60 flex flex-col overflow-hidden relative shadow-inner">
                {existingDocs.length > 0 ? (
                  <>
                    <iframe
                      src={`${existingDocs[0].url}#toolbar=0`}
                      className="w-full h-full border-none bg-white dark:bg-zinc-900"
                      title="Original Resume Preview"
                    />
                    <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded border border-border text-[10px] font-medium text-muted-foreground flex items-center gap-1 shadow-sm">
                      <span className="truncate max-w-[150px]">{existingDocs[0].name}</span>
                      <a
                        href={existingDocs[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-bold hover:underline ml-1 shrink-0"
                      >
                        Open File ↗
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
                    <Icon name="ScrollText" className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground italic">
                      No resume document attached to Profile A.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Profile B (Incoming Profile) Viewer */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.01] p-4 flex flex-col gap-3 shadow-sm relative overflow-hidden h-[420px] md:h-[500px] shrink-0">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h4 className="text-base font-bold tracking-tight text-foreground truncate max-w-[220px]">
                    {tempCandidate?.name || "Incoming Profile"}
                  </h4>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Profile B &bull; Incoming Profile
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 shadow-sm whitespace-nowrap shrink-0 animate-pulse"
                >
                  Incoming
                </Badge>
              </div>

              <div className="flex-1 rounded-lg border border-amber-500/20 bg-card/60 flex flex-col overflow-hidden relative shadow-inner">
                {tempDocs.length > 0 ? (
                  <>
                    <iframe
                      src={`${tempDocs[0].url}#toolbar=0`}
                      className="w-full h-full border-none bg-white dark:bg-zinc-900"
                      title="Incoming Resume Preview"
                    />
                    <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded border border-border text-[10px] font-medium text-muted-foreground flex items-center gap-1 shadow-sm">
                      <span className="truncate max-w-[150px]">{tempDocs[0].name}</span>
                      <a
                        href={tempDocs[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-600 dark:text-amber-400 font-bold hover:underline ml-1 shrink-0"
                      >
                        Open File ↗
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
                    <Icon name="ScrollText" className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground italic">
                      No resume document attached to Profile B.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 border-t border-border pt-4 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Close and Review Later
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
            onClick={() => void handleKeep()}
            disabled={loading || submitting}
            pending={submitting}
          >
            Keep Both (As Standalone)
          </Button>

          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            onClick={() => void handleMerge()}
            disabled={loading || submitting || !existingCandidate}
            pending={submitting}
          >
            <Icon name="Check" className="h-4 w-4 mr-1.5 shrink-0" />
            Merge & Keep Profile A (Original)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
