import { apiGet } from "../client/client";

// ── Types ──────────────────────────────────────────────────────────────────────

export type KPIMetric = {
  value: number;
  change_pct: number;
  trend: "up" | "down";
};

export type FunnelStage = {
  stage_name: string;
  count: number;
};

export type SourceItem = {
  source: string;
  candidates: number;
  interviews: number;
  hires: number;
  hire_rate_pct: number;
};

export type RecruiterItem = {
  user_id: string;
  name: string;
  candidates: number;
  interviews: number;
  hires: number;
  avg_days: number;
};

export type JobPerformanceItem = {
  id: string;
  title: string;
  applicants: number;
  conversion_pct: number;
  avg_days_to_hire: number;
  status: string;
};

export type StageTime = {
  stage: string;
  avg_days: number;
};

export type MonthTrend = {
  month: string;
  days: number;
};

export type TimeAnalyticsData = {
  avg_time_per_stage: StageTime[];
  time_to_hire_trend: MonthTrend[];
};

export type ReportsSummaryResponse = {
  kpis: {
    total_candidates: KPIMetric;
    active_jobs: KPIMetric;
    hires: KPIMetric;
    avg_time_to_hire_days: KPIMetric;
    offer_acceptance_rate: KPIMetric;
    conversion_rate: KPIMetric;
  };
  pipeline_funnel: FunnelStage[];
  source_effectiveness: SourceItem[];
  recruiter_performance: RecruiterItem[];
  job_performance: JobPerformanceItem[];
  time_analytics: TimeAnalyticsData;
};

// ── Period Options ─────────────────────────────────────────────────────────────

export type ReportPeriod = "7d" | "30d" | "90d" | "1y";

export const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "1y", label: "Last year" },
];

// ── API Functions ──────────────────────────────────────────────────────────────

export async function getReportsSummary(
  period: ReportPeriod = "30d",
): Promise<ReportsSummaryResponse> {
  return apiGet<ReportsSummaryResponse>(`/reports/summary?period=${period}`);
}
