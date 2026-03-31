"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { getJobWorkspace, type JobWorkspaceResponse } from "@/api";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";

type JobWorkspaceStageContextValue = {
  workspace: JobWorkspaceResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<JobWorkspaceResponse | undefined>;
};

const JobWorkspaceStageContext = createContext<JobWorkspaceStageContextValue | null>(null);

export function JobWorkspaceStageProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const jobId = params?.jobId as string | undefined;
  const { t } = useTranslation();

  const [workspace, setWorkspace] = useState<JobWorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!jobId) return;
    const data = await getJobWorkspace(jobId);
    setWorkspace(data);
    return data;
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await reload();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load job.");
          setWorkspace(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, reload]);

  useSetPageMetadata({
    title: t("job_candidate_edit_title"),
    subtitle: t("job_candidate_edit_subtitle"),
  });

  const value = useMemo(
    () => ({
      workspace,
      loading,
      error,
      reload,
    }),
    [workspace, loading, error, reload],
  );

  return (
    <JobWorkspaceStageContext.Provider value={value}>{children}</JobWorkspaceStageContext.Provider>
  );
}

export function useJobWorkspaceStage() {
  const ctx = useContext(JobWorkspaceStageContext);
  if (!ctx) {
    throw new Error("useJobWorkspaceStage must be used within JobWorkspaceStageProvider");
  }
  return ctx;
}
