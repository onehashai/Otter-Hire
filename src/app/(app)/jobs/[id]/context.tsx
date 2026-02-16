"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import type { JobStatusType, VisibilityType, SalaryType, TimeframeType } from "./constants";
import { mockJob } from "./constants";
import { useTranslation } from "react-i18next";

export type Stage = { name: string; interviewer: string };

export interface JobSetupState {
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
  visibility: VisibilityType;
  published: boolean;
  linkCopied: boolean;
  savedAt: string | null;
  citySearch: string;
  newQuestion: string;
  aiSheetOpen: boolean;
  summaryOpen: boolean;
  basicInfoAttemptedNext: boolean;
  hiringDetailsAttemptedSave: boolean;
}

const defaultState: JobSetupState = {
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
  visibility: "careers" as VisibilityType,
  published: false,
  linkCopied: false,
  savedAt: null,
  citySearch: "",
  newQuestion: "",
  aiSheetOpen: false,
  summaryOpen: false,
  basicInfoAttemptedNext: false,
  hiringDetailsAttemptedSave: false,
};

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
  setVisibility: (v: VisibilityType) => void;
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
  handleCountryChange: (val: string) => void;
  handleSave: () => void;
  handlePublish: () => void;
  handleUnpublish: () => void;
  handleCopyLink: () => void;
};

const JobSetupContext = createContext<JobSetupContextValue | null>(null);

export function JobSetupProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const id = params?.id as string | undefined;
  const isEdit = Boolean(id);
  const { t } = useTranslation();

  const [state, setState] = useState<JobSetupState>(defaultState);

  useEffect(() => {
    if (isEdit) {
      setState((s) => ({
        ...s,
        title: mockJob.title,
        department: mockJob.department,
        employmentType: mockJob.employmentType,
        workplaceType: mockJob.workplaceType,
        country: mockJob.country,
        city: mockJob.city,
        hiringManager: mockJob.hiringManager,
        status: mockJob.status,
        description: mockJob.description,
        openings: mockJob.openings,
        salaryType: mockJob.salaryType,
        salaryFixed: mockJob.salaryFixed,
        salaryMin: mockJob.salaryMin,
        salaryMax: mockJob.salaryMax,
        currency: mockJob.currency,
        timeframe: mockJob.timeframe,
        pipeline: mockJob.pipeline,
        collectResume: mockJob.collectResume,
        collectCover: mockJob.collectCover,
        screeningQuestions: mockJob.screeningQuestions,
        stages: mockJob.stages,
        visibility: mockJob.visibility,
      }));
    }
  }, [isEdit]);

  useEffect(() => {
    const t = setInterval(() => {
      setState((s) => ({ ...s, savedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
    }, 10000);
    return () => clearInterval(t);
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

  const handleCountryChange = useCallback((val: string) => {
    setState((s) => ({ ...s, country: val, city: "", citySearch: "" }));
  }, []);

  const handleSave = useCallback(() => {
    setState((s) => ({ ...s, savedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
    toast.success(t("draft_saved"));
  }, []);

  const handlePublish = useCallback(() => {
    setState((s) => ({ ...s, status: "open", published: true }));
    toast.success(t("job_published"));
  }, []);

  const handleUnpublish = useCallback(() => {
    setState((s) => ({ ...s, status: "draft", published: false }));
    toast.success(t("job_unpublished"));
  }, []);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText("https://careers.acme.com/jobs/senior-frontend");
    setState((s) => ({ ...s, linkCopied: true }));
    setTimeout(() => setState((s) => ({ ...s, linkCopied: false })), 2000);
  }, []);

  const value: JobSetupContextValue = {
    ...state,
    setTitle: (v) => setState((s) => ({ ...s, title: v })),
    setDepartment: (v) => setState((s) => ({ ...s, department: v })),
    setEmploymentType: (v) => setState((s) => ({ ...s, employmentType: v })),
    setWorkplaceType: (v) => setState((s) => ({ ...s, workplaceType: v })),
    setCountry: (v) => setState((s) => ({ ...s, country: v })),
    setCity: (v) => setState((s) => ({ ...s, city: v })),
    setHiringManager: (v) => setState((s) => ({ ...s, hiringManager: v })),
    setStatus: (v) => setState((s) => ({ ...s, status: v })),
    setDescription: (v) => setState((s) => ({ ...s, description: v })),
    setOpenings: (v) => setState((s) => ({ ...s, openings: v })),
    setSalaryType: (v) => setState((s) => ({ ...s, salaryType: v })),
    setSalaryFixed: (v) => setState((s) => ({ ...s, salaryFixed: v })),
    setSalaryMin: (v) => setState((s) => ({ ...s, salaryMin: v })),
    setSalaryMax: (v) => setState((s) => ({ ...s, salaryMax: v })),
    setCurrency: (v) => setState((s) => ({ ...s, currency: v })),
    setTimeframe: (v) => setState((s) => ({ ...s, timeframe: v })),
    setPipeline: (v) => setState((s) => ({ ...s, pipeline: v })),
    setCollectResume: (v) => setState((s) => ({ ...s, collectResume: v })),
    setCollectCover: (v) => setState((s) => ({ ...s, collectCover: v })),
    setScreeningQuestions: (v) => setState((s) => ({ ...s, screeningQuestions: v })),
    setStages: (v) => setState((s) => ({ ...s, stages: v })),
    setVisibility: (v) => setState((s) => ({ ...s, visibility: v })),
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
