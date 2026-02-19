"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JobStatusType, VisibilityType, SalaryType, TimeframeType, TeamRole } from "./constants";
import { defaultHiringStages } from "./constants";
import type { HiringStage, TeamMember } from "./constants";
import { useTranslation } from "react-i18next";
import {
  getJobById,
  updateJob,
  publishJob as apiPublishJob,
  unpublishJob as apiUnpublishJob,
  closeJob as apiCloseJob,
  type JobDetailResponse,
  type JobUpdatePayload,
} from "@/lib/api";

export type Stage = { name: string; interviewer: string };

export interface JobSetupState {
  jobId: string | null;
  title: string;
  department: string;
  employmentType: string;
  workplaceType: string;
  country: string;
  city: string;
  hiringManager: string;
  status: JobStatusType;
  description: string;
  openings: number;
  salaryType: SalaryType;
  salaryFixed: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  timeframe: TimeframeType;
  pipeline: string;
  collectResume: boolean;
  collectCover: boolean;
  screeningQuestions: string[];
  stages: Stage[];
  hiringStages: HiringStage[];
  teamMembers: TeamMember[];
  published: boolean;
  linkCopied: boolean;
  savedAt: string | null;
  citySearch: string;
  newQuestion: string;
  aiSheetOpen: boolean;
  summaryOpen: boolean;
  basicInfoAttemptedNext: boolean;
  hiringDetailsAttemptedSave: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
}

const defaultState: JobSetupState = {
  jobId: null,
  title: "",
  department: "",
  employmentType: "full_time",
  workplaceType: "remote",
  country: "",
  city: "",
  hiringManager: "",
  status: "draft" as JobStatusType,
  description: "",
  openings: 1,
  salaryType: "hidden",
  salaryFixed: "",
  salaryMin: "",
  salaryMax: "",
  currency: "USD",
  timeframe: "per_year" as TimeframeType,
  pipeline: "standard",
  collectResume: true,
  collectCover: false,
  screeningQuestions: [],
  stages: [
    { name: "Phone Screen", interviewer: "" },
    { name: "Technical", interviewer: "" },
    { name: "Final", interviewer: "" },
  ],
  hiringStages: defaultHiringStages.map((s) => ({ ...s, id: crypto.randomUUID() })),
  teamMembers: [],
  visibility: "internal" as VisibilityType,
  published: false,
  linkCopied: false,
  savedAt: null,
  citySearch: "",
  newQuestion: "",
  aiSheetOpen: false,
  summaryOpen: false,
  basicInfoAttemptedNext: false,
  hiringDetailsAttemptedSave: false,
  isLoading: true,
  isSaving: false,
  isPublishing: false,
};

function mapApiToState(job: JobDetailResponse): Partial<JobSetupState> {
  return {
    jobId: job.id,
    title: job.title,
    department: job.department ?? "",
    employmentType: job.employment_type ?? "full_time",
    workplaceType: job.workplace_type ?? "remote",
    country: job.country ?? "",
    city: job.city ?? "",
    status: job.status as JobStatusType,
    description: job.description ?? "",
    openings: job.openings,
    salaryType: (job.salary_type ?? "hidden") as SalaryType,
    salaryFixed: job.salary_fixed != null ? String(job.salary_fixed) : "",
    salaryMin: job.salary_min != null ? String(job.salary_min) : "",
    salaryMax: job.salary_max != null ? String(job.salary_max) : "",
    currency: job.currency ?? "USD",
    timeframe: (job.salary_timeframe ?? "per_year") as TimeframeType,
    pipeline: job.pipeline_template ?? "standard",
    collectResume: job.collect_resume,
    collectCover: job.collect_cover,
    screeningQuestions: job.screening_questions ?? [],
    hiringStages: job.hiring_stages.map((s) => ({ id: s.id, name: s.name })),
    teamMembers: job.team_members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      name: m.name ?? "",
      email: m.email ?? "",
      role: m.role as TeamRole,
    })),
    visibility: (job.visibility ?? "internal") as VisibilityType,
    published: job.status === "open",
    isLoading: false,
  };
}

type JobSetupContextValue = JobSetupState & {
  setTitle: (v: string) => void;
  setDepartment: (v: string) => void;
  setEmploymentType: (v: string) => void;
  setWorkplaceType: (v: string) => void;
  setCountry: (v: string) => void;
  setCity: (v: string) => void;
  setHiringManager: (v: string) => void;
  setStatus: (v: JobStatusType) => void;
  setDescription: (v: string) => void;
  setOpenings: (v: number) => void;
  setSalaryType: (v: SalaryType) => void;
  setSalaryFixed: (v: string) => void;
  setSalaryMin: (v: string) => void;
  setSalaryMax: (v: string) => void;
  setCurrency: (v: string) => void;
  setTimeframe: (v: TimeframeType) => void;
  setPipeline: (v: string) => void;
  setCollectResume: (v: boolean) => void;
  setCollectCover: (v: boolean) => void;
  setScreeningQuestions: (v: string[]) => void;
  setStages: (v: Stage[]) => void;
  setHiringStages: (v: HiringStage[]) => void;
  setTeamMembers: (v: TeamMember[]) => void;
  setPublished: (v: boolean) => void;
  setLinkCopied: (v: boolean) => void;
  setSavedAt: (v: string | null) => void;
  setCitySearch: (v: string) => void;
  setNewQuestion: (v: string) => void;
  setAiSheetOpen: (v: boolean) => void;
  setSummaryOpen: (v: boolean) => void;
  setBasicInfoAttemptedSave: (v: boolean) => void;
  setHiringDetailsAttemptedSave: (v: boolean) => void;
  addQuestion: () => void;
  removeQuestion: (i: number) => void;
  addStage: () => void;
  removeStage: (i: number) => void;
  updateStage: (i: number, field: "name" | "interviewer", val: string) => void;
  addHiringStage: () => void;
  removeHiringStage: (id: string) => void;
  updateHiringStageName: (id: string, name: string) => void;
  reorderHiringStages: (fromIndex: number, toIndex: number) => void;
  addTeamMember: (member: Omit<TeamMember, "role"> & { role: TeamRole }) => void;
  removeTeamMember: (id: string) => void;
  updateTeamMemberRole: (id: string, role: TeamRole) => void;
  handleCountryChange: (val: string) => void;
  handleSave: () => void;
  handlePublish: () => void;
  handleUnpublish: () => void;
  handleCopyLink: () => void;
};

const JobSetupContext = createContext<JobSetupContextValue | null>(null);

export function JobSetupProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const id = params?.jobId as string | undefined;
  const { t } = useTranslation();

  const [state, setState] = useState<JobSetupState>(defaultState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef<JobUpdatePayload | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const job = await getJobById(id);
        if (!cancelled) {
          setState((s) => ({ ...s, ...mapApiToState(job) }));
        }
      } catch {
        if (!cancelled) {
          toast.error(t("job_not_found") || "Job not found");
          router.replace("/jobs");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, router, t]);

  const stagesDirtyRef = useRef(false);
  const teamDirtyRef = useRef(false);

  const buildPayload = useCallback((currentState: JobSetupState, includeRelations: boolean): JobUpdatePayload => {
    const payload: JobUpdatePayload = {
      title: currentState.title,
      department: currentState.department || null,
      employment_type: currentState.employmentType || null,
      workplace_type: currentState.workplaceType,
      country: currentState.country || null,
      city: currentState.city || null,
      openings: currentState.openings,
      salary_type: currentState.salaryType,
      salary_fixed: currentState.salaryFixed ? Number(currentState.salaryFixed) : null,
      salary_min: currentState.salaryMin ? Number(currentState.salaryMin) : null,
      salary_max: currentState.salaryMax ? Number(currentState.salaryMax) : null,
      currency: currentState.currency,
      salary_timeframe: currentState.timeframe,
      description: currentState.description || null,
      visibility: currentState.visibility,
      collect_resume: currentState.collectResume,
      collect_cover: currentState.collectCover,
      screening_questions: currentState.screeningQuestions,
      pipeline_template: currentState.pipeline,
    };
    if (includeRelations || stagesDirtyRef.current) {
      payload.hiring_stages = currentState.hiringStages
        .filter((s) => s.name.trim())
        .map((s, i) => ({ name: s.name, position: i }));
      stagesDirtyRef.current = false;
    }
    if (includeRelations || teamDirtyRef.current) {
      payload.team_members = currentState.teamMembers.map((m) => ({
        user_id: m.user_id ?? m.id,
        role: m.role,
      }));
      teamDirtyRef.current = false;
    }
    return payload;
  }, []);

  const executeSave = useCallback(async (payload: JobUpdatePayload) => {
    if (!id || savingRef.current) {
      pendingSaveRef.current = payload;
      return;
    }
    savingRef.current = true;
    setState((s) => ({ ...s, isSaving: true }));
    try {
      const job = await updateJob(id, payload);
      setState((s) => ({
        ...s,
        ...mapApiToState(job),
        isSaving: false,
        savedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
      if (pendingSaveRef.current) {
        const next = pendingSaveRef.current;
        pendingSaveRef.current = null;
        savingRef.current = false;
        await executeSave(next);
        return;
      }
    } catch (err) {
      setState((s) => ({ ...s, isSaving: false }));
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      savingRef.current = false;
    }
  }, [id]);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setState((currentState) => {
        if (!currentState.jobId || !currentState.title.trim()) return currentState;
        const payload = buildPayload(currentState, false);
        executeSave(payload);
        return currentState;
      });
    }, 1500);
  }, [buildPayload, executeSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const addQuestion = useCallback(() => {
    setState((s) => {
      if (!s.newQuestion.trim()) return s;
      return {
        ...s,
        screeningQuestions: [...s.screeningQuestions, s.newQuestion.trim()],
        newQuestion: "",
      };
    });
  }, []);

  const removeQuestion = useCallback((i: number) => {
    setState((s) => ({
      ...s,
      screeningQuestions: s.screeningQuestions.filter((_, idx) => idx !== i),
    }));
  }, []);

  const addStage = useCallback(() => {
    setState((s) => ({ ...s, stages: [...s.stages, { name: "", interviewer: "" }] }));
  }, []);

  const removeStage = useCallback((i: number) => {
    setState((s) => {
      if (s.stages.length <= 1) return s;
      return { ...s, stages: s.stages.filter((_, idx) => idx !== i) };
    });
  }, []);

  const updateStage = useCallback((i: number, field: "name" | "interviewer", val: string) => {
    setState((s) => ({
      ...s,
      stages: s.stages.map((st, idx) => (idx === i ? { ...st, [field]: val } : st)),
    }));
  }, []);

  const addHiringStage = useCallback(() => {
    stagesDirtyRef.current = true;
    setState((s) => ({
      ...s,
      hiringStages: [...s.hiringStages, { id: crypto.randomUUID(), name: "" }],
    }));
    debouncedSave();
  }, [debouncedSave]);

  const removeHiringStage = useCallback((id: string) => {
    stagesDirtyRef.current = true;
    setState((s) => {
      if (s.hiringStages.length <= 2) return s;
      return { ...s, hiringStages: s.hiringStages.filter((st) => st.id !== id) };
    });
    debouncedSave();
  }, [debouncedSave]);

  const updateHiringStageName = useCallback((id: string, name: string) => {
    stagesDirtyRef.current = true;
    setState((s) => ({
      ...s,
      hiringStages: s.hiringStages.map((st) => (st.id === id ? { ...st, name } : st)),
    }));
    debouncedSave();
  }, [debouncedSave]);

  const reorderHiringStages = useCallback((fromIndex: number, toIndex: number) => {
    stagesDirtyRef.current = true;
    setState((s) => {
      const reordered = [...s.hiringStages];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return { ...s, hiringStages: reordered };
    });
    debouncedSave();
  }, [debouncedSave]);

  const addTeamMember = useCallback((member: Omit<TeamMember, "role"> & { role: TeamRole }) => {
    teamDirtyRef.current = true;
    setState((s) => ({
      ...s,
      teamMembers: [...s.teamMembers, { ...member, role: member.role }],
    }));
    debouncedSave();
  }, [debouncedSave]);

  const removeTeamMember = useCallback((id: string) => {
    teamDirtyRef.current = true;
    setState((s) => ({
      ...s,
      teamMembers: s.teamMembers.filter((m) => m.id !== id),
    }));
    debouncedSave();
  }, [debouncedSave]);

  const updateTeamMemberRole = useCallback((id: string, role: TeamRole) => {
    teamDirtyRef.current = true;
    setState((s) => ({
      ...s,
      teamMembers: s.teamMembers.map((m) => (m.id === id ? { ...m, role } : m)),
    }));
    debouncedSave();
  }, [debouncedSave]);

  const handleCountryChange = useCallback((val: string) => {
    setState((s) => ({ ...s, country: val, city: "", citySearch: "" }));
  }, []);

  const handleSave = useCallback(() => {
    setState((currentState) => {
      if (!currentState.jobId) return currentState;
      const payload = buildPayload(currentState, true);
      executeSave(payload).then(() => {
        toast.success(t("draft_saved"));
      });
      return currentState;
    });
  }, [buildPayload, executeSave, t]);

  const handlePublish = useCallback(async () => {
    if (!id) return;
    setState((s) => ({ ...s, isPublishing: true }));
    try {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      let currentPayload: JobUpdatePayload | null = null;
      setState((s) => {
        currentPayload = buildPayload(s, true);
        return s;
      });
      if (currentPayload) {
        await updateJob(id, currentPayload);
      }
      const job = await apiPublishJob(id);
      setState((s) => ({
        ...s,
        ...mapApiToState(job),
        isPublishing: false,
      }));
      toast.success(t("job_published"));
    } catch (err) {
      setState((s) => ({ ...s, isPublishing: false }));
      toast.error(err instanceof Error ? err.message : "Failed to publish");
    }
  }, [id, buildPayload, t]);

  const handleUnpublish = useCallback(async () => {
    if (!id) return;
    setState((s) => ({ ...s, isPublishing: true }));
    try {
      const job = await apiUnpublishJob(id);
      setState((s) => ({
        ...s,
        ...mapApiToState(job),
        isPublishing: false,
      }));
      toast.success(t("job_unpublished"));
    } catch (err) {
      setState((s) => ({ ...s, isPublishing: false }));
      toast.error(err instanceof Error ? err.message : "Failed to unpublish");
    }
  }, [id, t]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/jobs/${id}`);
    setState((s) => ({ ...s, linkCopied: true }));
    setTimeout(() => setState((s) => ({ ...s, linkCopied: false })), 2000);
  }, [id]);

  const value: JobSetupContextValue = {
    ...state,
    setTitle: (v) => { setState((s) => ({ ...s, title: v })); debouncedSave(); },
    setDepartment: (v) => { setState((s) => ({ ...s, department: v })); debouncedSave(); },
    setEmploymentType: (v) => { setState((s) => ({ ...s, employmentType: v })); debouncedSave(); },
    setWorkplaceType: (v) => { setState((s) => ({ ...s, workplaceType: v })); debouncedSave(); },
    setCountry: (v) => { setState((s) => ({ ...s, country: v })); debouncedSave(); },
    setCity: (v) => { setState((s) => ({ ...s, city: v })); debouncedSave(); },
    setHiringManager: (v) => setState((s) => ({ ...s, hiringManager: v })),
    setStatus: (v) => setState((s) => ({ ...s, status: v })),
    setDescription: (v) => { setState((s) => ({ ...s, description: v })); debouncedSave(); },
    setOpenings: (v) => { setState((s) => ({ ...s, openings: v })); debouncedSave(); },
    setSalaryType: (v) => { setState((s) => ({ ...s, salaryType: v })); debouncedSave(); },
    setSalaryFixed: (v) => { setState((s) => ({ ...s, salaryFixed: v })); debouncedSave(); },
    setSalaryMin: (v) => { setState((s) => ({ ...s, salaryMin: v })); debouncedSave(); },
    setSalaryMax: (v) => { setState((s) => ({ ...s, salaryMax: v })); debouncedSave(); },
    setCurrency: (v) => { setState((s) => ({ ...s, currency: v })); debouncedSave(); },
    setTimeframe: (v) => { setState((s) => ({ ...s, timeframe: v })); debouncedSave(); },
    setPipeline: (v) => { setState((s) => ({ ...s, pipeline: v })); debouncedSave(); },
    setCollectResume: (v) => { setState((s) => ({ ...s, collectResume: v })); debouncedSave(); },
    setCollectCover: (v) => { setState((s) => ({ ...s, collectCover: v })); debouncedSave(); },
    setScreeningQuestions: (v) => { setState((s) => ({ ...s, screeningQuestions: v })); debouncedSave(); },
    setStages: (v) => setState((s) => ({ ...s, stages: v })),
    setHiringStages: (v) => { stagesDirtyRef.current = true; setState((s) => ({ ...s, hiringStages: v })); debouncedSave(); },
    setTeamMembers: (v) => { teamDirtyRef.current = true; setState((s) => ({ ...s, teamMembers: v })); debouncedSave(); },
    setVisibility: (v) => { setState((s) => ({ ...s, visibility: v })); debouncedSave(); },
    setPublished: (v) => setState((s) => ({ ...s, published: v })),
    setLinkCopied: (v) => setState((s) => ({ ...s, linkCopied: v })),
    setSavedAt: (v) => setState((s) => ({ ...s, savedAt: v })),
    setCitySearch: (v) => setState((s) => ({ ...s, citySearch: v })),
    setNewQuestion: (v) => setState((s) => ({ ...s, newQuestion: v })),
    setAiSheetOpen: (v) => setState((s) => ({ ...s, aiSheetOpen: v })),
    setSummaryOpen: (v) => setState((s) => ({ ...s, summaryOpen: v })),
    setBasicInfoAttemptedSave: (v) => setState((s) => ({ ...s, basicInfoAttemptedNext: v })),
    setHiringDetailsAttemptedSave: (v) => setState((s) => ({ ...s, hiringDetailsAttemptedSave: v })),
    addQuestion,
    removeQuestion,
    addStage,
    removeStage,
    updateStage,
    addHiringStage,
    removeHiringStage,
    updateHiringStageName,
    reorderHiringStages,
    addTeamMember,
    removeTeamMember,
    updateTeamMemberRole,
    handleCountryChange,
    handleSave,
    handlePublish,
    handleUnpublish,
    handleCopyLink,
  };

  return (
    <JobSetupContext.Provider value={value}>
      {children}
    </JobSetupContext.Provider>
  );
}

export function useJobSetup() {
  const ctx = useContext(JobSetupContext);
  if (!ctx) throw new Error("useJobSetup must be used within JobSetupProvider");
  return ctx;
}
