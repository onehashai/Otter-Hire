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
import type { JobStatusType, SalaryType, TimeframeType, TeamRole } from "./constants";
import type { HiringStage, TeamMember } from "./constants";
import { useTranslation } from "react-i18next";
import {
  getJobById,
  updateJob,
  publishJob as apiPublishJob,
  unpublishJob as apiUnpublishJob,
  archiveJob as apiArchiveJob,
  type JobDetailResponse,
  type JobUpdatePayload,
} from "@/api";

export type Stage = { name: string; interviewer: string };

export interface JobSetupState {
  jobId: string | null;
  title: string;
  category: string;
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
  applicationFormSchema: Record<string, unknown>;
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
  hasUnsavedChanges: boolean;
  showUnsavedDialog: boolean;
  pendingNavigation: string | null;
}

const defaultState: JobSetupState = {
  jobId: null,
  title: "",
  category: "Engineering",
  employmentType: "full_time",
  workplaceType: "onsite",
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
  applicationFormSchema: {},
  stages: [
    { name: "Phone Screen", interviewer: "" },
    { name: "Technical", interviewer: "" },
    { name: "Final", interviewer: "" },
  ],
  hiringStages: [],
  teamMembers: [],
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
  hasUnsavedChanges: false,
  showUnsavedDialog: false,
  pendingNavigation: null,
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${entries.join(",")}}`;
}

function mapApiToState(job: JobDetailResponse): Partial<JobSetupState> {
  return {
    jobId: job.id,
    title: job.title,
    category: job.category ?? "",
    employmentType: job.employment_type ?? "full_time",
    workplaceType: job.workplace_type ?? "onsite",
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
    applicationFormSchema: (job.application_form_schema ?? {}) as Record<string, unknown>,
    hiringStages: job.hiring_stages.map((s) => ({
      id: s.id,
      name: s.name,
      isRequired: s.is_required,
    })),
    teamMembers: job.team_members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      name: m.name ?? "",
      email: m.email ?? "",
      role: m.role as TeamRole,
      userRole: m.user_role,
    })),
    published: job.status === "open",
    isLoading: false,
  };
}

type JobSetupContextValue = JobSetupState & {
  setTitle: (v: string) => void;
  setCategory: (v: string) => void;
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
  setApplicationFormSchema: (v: Record<string, unknown>) => void;
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
  addHiringStageAndSave: (name: string) => Promise<void>;
  removeHiringStage: (id: string) => void;
  removeHiringStageAndSave: (id: string) => Promise<void>;
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
  handleDiscardChanges: () => void;
  handleSaveAndNavigate: () => void;
  handleCancelNavigation: () => void;
  showUnsavedWarning: (path: string) => void;
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
    if (!id) {
      // New job - use defaults and set loading to false
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
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
    return () => {
      cancelled = true;
    };
  }, [id, router, t]);

  const stagesDirtyRef = useRef(false);
  const teamDirtyRef = useRef(false);

  const buildPayload = useCallback(
    (currentState: JobSetupState, includeRelations: boolean): JobUpdatePayload => {
      const payload: JobUpdatePayload = {
        title: currentState.title,
        category: currentState.category || null,
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
        collect_resume: currentState.collectResume,
        collect_cover: currentState.collectCover,
        screening_questions: currentState.screeningQuestions,
        application_form_schema: currentState.applicationFormSchema,
        pipeline_template: currentState.pipeline,
      };
      if (includeRelations || stagesDirtyRef.current) {
        payload.hiring_stages = currentState.hiringStages
          .filter((s) => s.name.trim())
          .map((s, i) => ({ id: s.id, name: s.name, position: i }));
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
    },
    [],
  );

  const executeSave = useCallback(
    async (payload: JobUpdatePayload) => {
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
          hasUnsavedChanges: false,
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
        throw err;
      } finally {
        savingRef.current = false;
      }
    },
    [id],
  );

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setState((currentState) => {
        if (!currentState.jobId || !currentState.title.trim()) return currentState;
        const payload = buildPayload(currentState, false);
        void executeSave(payload).catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to save");
        });
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
      hasUnsavedChanges: true,
    }));
  }, []);

  const addHiringStageAndSave = useCallback(
    async (name: string) => {
      const stageName = name.trim();
      if (!stageName) return;

      let nextStateSnapshot: JobSetupState | null = null;
      stagesDirtyRef.current = true;
      setState((s) => {
        const nextState = {
          ...s,
          hiringStages: [...s.hiringStages, { id: crypto.randomUUID(), name: stageName }],
          hasUnsavedChanges: true,
        };
        nextStateSnapshot = nextState;
        return nextState;
      });

      if (!nextStateSnapshot?.jobId) return;
      const payload = buildPayload(nextStateSnapshot, true);
      await executeSave(payload);
      setState((s) => ({ ...s, hasUnsavedChanges: false }));
    },
    [buildPayload, executeSave],
  );

  const removeHiringStage = useCallback((id: string) => {
    stagesDirtyRef.current = true;
    setState((s) => {
      if (s.hiringStages.length <= 2) return s;
      return {
        ...s,
        hiringStages: s.hiringStages.filter((st) => st.id !== id),
        hasUnsavedChanges: true,
      };
    });
  }, []);

  const removeHiringStageAndSave = useCallback(
    async (id: string) => {
      let nextStateSnapshot: JobSetupState | null = null;
      stagesDirtyRef.current = true;
      setState((s) => {
        if (s.hiringStages.length <= 2) {
          nextStateSnapshot = s;
          return s;
        }
        const nextState = {
          ...s,
          hiringStages: s.hiringStages.filter((st) => st.id !== id),
          hasUnsavedChanges: true,
        };
        nextStateSnapshot = nextState;
        return nextState;
      });

      if (!nextStateSnapshot?.jobId) return;
      const payload = buildPayload(nextStateSnapshot, true);
      await executeSave(payload);
      setState((s) => ({ ...s, hasUnsavedChanges: false }));
    },
    [buildPayload, executeSave],
  );

  const updateHiringStageName = useCallback((id: string, name: string) => {
    stagesDirtyRef.current = true;
    setState((s) => ({
      ...s,
      hiringStages: s.hiringStages.map((st) => (st.id === id ? { ...st, name } : st)),
      hasUnsavedChanges: true,
    }));
  }, []);

  const reorderHiringStages = useCallback((fromIndex: number, toIndex: number) => {
    stagesDirtyRef.current = true;
    setState((s) => {
      const reordered = [...s.hiringStages];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return { ...s, hiringStages: reordered, hasUnsavedChanges: true };
    });
  }, []);

  const addTeamMember = useCallback((member: Omit<TeamMember, "role"> & { role: TeamRole }) => {
    teamDirtyRef.current = true;
    setState((s) => ({
      ...s,
      teamMembers: [...s.teamMembers, { ...member, role: member.role }],
      hasUnsavedChanges: true,
    }));
  }, []);

  const removeTeamMember = useCallback((id: string) => {
    teamDirtyRef.current = true;
    setState((s) => ({
      ...s,
      teamMembers: s.teamMembers.filter((m) => m.id !== id),
      hasUnsavedChanges: true,
    }));
  }, []);

  const updateTeamMemberRole = useCallback((id: string, role: TeamRole) => {
    teamDirtyRef.current = true;
    setState((s) => ({
      ...s,
      teamMembers: s.teamMembers.map((m) => (m.id === id ? { ...m, role } : m)),
      hasUnsavedChanges: true,
    }));
  }, []);

  const handleCountryChange = useCallback((val: string) => {
    setState((s) => ({ ...s, country: val, city: "", citySearch: "" }));
  }, []);

  const handleSave = useCallback(() => {
    setState((currentState) => {
      if (!currentState.jobId) return currentState;
      const payload = buildPayload(currentState, false);
      executeSave(payload)
        .then(() => {
          setState((s) => ({ ...s, hasUnsavedChanges: false }));
          toast.success(t("draft_saved"));
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to save");
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

  const handleDiscardChanges = useCallback(() => {
    setState((s) => ({ ...s, hasUnsavedChanges: false, showUnsavedDialog: false }));
    const nav = state.pendingNavigation;
    setState((s) => ({ ...s, pendingNavigation: null }));
    if (nav) {
      router.push(nav);
    }
  }, [router, state.pendingNavigation]);

  const handleSaveAndNavigate = useCallback(() => {
    setState((currentState) => {
      if (!currentState.jobId) return currentState;
      const payload = buildPayload(currentState, false);
      executeSave(payload)
        .then(() => {
          setState((s) => ({ ...s, hasUnsavedChanges: false, showUnsavedDialog: false }));
          if (currentState.pendingNavigation) {
            router.push(currentState.pendingNavigation);
          }
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to save");
        });
      return currentState;
    });
  }, [buildPayload, executeSave, router]);

  const handleCancelNavigation = useCallback(() => {
    setState((s) => ({ ...s, showUnsavedDialog: false, pendingNavigation: null }));
  }, []);

  const showUnsavedWarning = useCallback((path: string) => {
    setState((s) => ({ ...s, showUnsavedDialog: true, pendingNavigation: path }));
  }, []);

  const markUnsaved = useCallback(() => {
    setState((s) => ({ ...s, hasUnsavedChanges: true }));
  }, []);

  const value: JobSetupContextValue = {
    ...state,
    setTitle: (v) => {
      setState((s) => ({ ...s, title: v }));
      markUnsaved();
    },
    setCategory: (v) => {
      setState((s) => ({ ...s, category: v }));
      markUnsaved();
    },
    setEmploymentType: (v) => {
      setState((s) => ({ ...s, employmentType: v }));
      markUnsaved();
    },
    setWorkplaceType: (v) => {
      setState((s) => ({ ...s, workplaceType: v }));
      markUnsaved();
    },
    setCountry: (v) => {
      setState((s) => ({ ...s, country: v }));
      markUnsaved();
    },
    setCity: (v) => {
      setState((s) => ({ ...s, city: v }));
      markUnsaved();
    },
    setHiringManager: (v) => setState((s) => ({ ...s, hiringManager: v })),
    setStatus: (v) => setState((s) => ({ ...s, status: v })),
    setDescription: (v) => {
      setState((s) => ({ ...s, description: v }));
      markUnsaved();
    },
    setOpenings: (v) => {
      setState((s) => ({ ...s, openings: v }));
      markUnsaved();
    },
    setSalaryType: (v) => {
      setState((s) => ({ ...s, salaryType: v }));
      markUnsaved();
    },
    setSalaryFixed: (v) => {
      setState((s) => ({ ...s, salaryFixed: v }));
      markUnsaved();
    },
    setSalaryMin: (v) => {
      setState((s) => ({ ...s, salaryMin: v }));
      markUnsaved();
    },
    setSalaryMax: (v) => {
      setState((s) => ({ ...s, salaryMax: v }));
      markUnsaved();
    },
    setCurrency: (v) => {
      setState((s) => ({ ...s, currency: v }));
      markUnsaved();
    },
    setTimeframe: (v) => {
      setState((s) => ({ ...s, timeframe: v }));
      markUnsaved();
    },
    setPipeline: (v) => {
      setState((s) => ({ ...s, pipeline: v }));
      markUnsaved();
    },
    setCollectResume: (v) => {
      setState((s) => ({ ...s, collectResume: v }));
      markUnsaved();
    },
    setCollectCover: (v) => {
      setState((s) => ({ ...s, collectCover: v }));
      markUnsaved();
    },
    setScreeningQuestions: (v) => {
      setState((s) => ({ ...s, screeningQuestions: v }));
      markUnsaved();
    },
    setApplicationFormSchema: (v) => {
      let changed = false;
      setState((s) => {
        const prev = stableStringify(s.applicationFormSchema ?? {});
        const next = stableStringify(v ?? {});
        changed = prev !== next;
        if (!changed) return s;
        return { ...s, applicationFormSchema: v };
      });
      if (changed) markUnsaved();
    },
    setStages: (v) => setState((s) => ({ ...s, stages: v })),
    setHiringStages: (v) => {
      stagesDirtyRef.current = true;
      setState((s) => ({ ...s, hiringStages: v }));
      markUnsaved();
    },
    setTeamMembers: (v) => {
      teamDirtyRef.current = true;
      setState((s) => ({ ...s, teamMembers: v }));
      markUnsaved();
    },
    setPublished: (v) => setState((s) => ({ ...s, published: v })),
    setLinkCopied: (v) => setState((s) => ({ ...s, linkCopied: v })),
    setSavedAt: (v) => setState((s) => ({ ...s, savedAt: v })),
    setCitySearch: (v) => setState((s) => ({ ...s, citySearch: v })),
    setNewQuestion: (v) => setState((s) => ({ ...s, newQuestion: v })),
    setAiSheetOpen: (v) => setState((s) => ({ ...s, aiSheetOpen: v })),
    setSummaryOpen: (v) => setState((s) => ({ ...s, summaryOpen: v })),
    setBasicInfoAttemptedSave: (v) => setState((s) => ({ ...s, basicInfoAttemptedNext: v })),
    setHiringDetailsAttemptedSave: (v) =>
      setState((s) => ({ ...s, hiringDetailsAttemptedSave: v })),
    addQuestion,
    removeQuestion,
    addStage,
    removeStage,
    updateStage,
    addHiringStage,
    addHiringStageAndSave,
    removeHiringStage,
    removeHiringStageAndSave,
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
    handleDiscardChanges,
    handleSaveAndNavigate,
    handleCancelNavigation,
    showUnsavedWarning,
  };

  return <JobSetupContext.Provider value={value}>{children}</JobSetupContext.Provider>;
}

export function useJobSetup() {
  const ctx = useContext(JobSetupContext);
  if (!ctx) throw new Error("useJobSetup must be used within JobSetupProvider");
  return ctx;
}
