"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { Users, Briefcase, UserCheck, Clock, ThumbsUp, ArrowRight, Download } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { Card, CardContent } from "@onehash/ui/card";
import { Skeleton } from "@onehash/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { KPICard } from "@/components/reports/KPICard";
import { FunnelSection } from "@/components/reports/FunnelSection";
import { TimeMetrics } from "@/components/reports/TimeMetrics";
import { JobPerformanceSection } from "@/components/reports/JobPerformanceSection";
import { RecruiterComparisonTable } from "@/components/reports/RecruiterComparisonTable";
import { RecruiterPerformanceCard } from "@/components/reports/RecruiterPerformanceCard";
import { SourceEffectivenessSection } from "@/components/reports/SourceEffectivenessSection";
import {
  getReportsSummary,
  PERIOD_OPTIONS,
  type ReportsSummaryResponse,
  type ReportPeriod,
} from "@/api/reports";
import type { KPIDataItem } from "@/components/reports/KPICard";

// ── KPI config ─────────────────────────────────────────────────────────────────

type KPIKey = keyof ReportsSummaryResponse["kpis"];

const KPI_CONFIG: {
  key: KPIKey;
  title: string;
  icon: KPIDataItem["icon"];
  format: (v: number) => string;
}[] = [
  {
    key: "total_candidates",
    title: "Total Candidates",
    icon: Users,
    format: (v) => Math.round(v).toLocaleString(),
  },
  {
    key: "active_jobs",
    title: "Active Jobs",
    icon: Briefcase,
    format: (v) => Math.round(v).toString(),
  },
  { key: "hires", title: "Hires", icon: UserCheck, format: (v) => Math.round(v).toString() },
  {
    key: "avg_time_to_hire_days",
    title: "Time to Hire",
    icon: Clock,
    format: (v) => {
      if (v <= 0) return "0d";
      if (v < 1) return "<1d";
      return `${Math.round(v)}d`;
    },
  },
  {
    key: "offer_acceptance_rate",
    title: "Offer Acceptance",
    icon: ThumbsUp,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "conversion_rate",
    title: "Conversion Rate",
    icon: ArrowRight,
    format: (v) => `${v.toFixed(2)}%`,
  },
];

// ── Loading skeleton ────────────────────────────────────────────────────────────

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-32 mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-[280px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
      <Skeleton className="h-[280px] rounded-xl" />
    </div>
  );
}

// ── CSV Export ──────────────────────────────────────────────────────────────────

function exportCSV(filename: string, rows: string[][]): void {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTabData(tab: string, data: ReportsSummaryResponse): void {
  if (tab === "overview") {
    const rows = [
      ["Metric", "Value", "Change %", "Trend"],
      ...KPI_CONFIG.map(({ key, title }) => {
        const m = data.kpis[key];
        return [title, String(m.value), String(m.change_pct), m.trend];
      }),
    ];
    exportCSV("reports-overview.csv", rows);
  } else if (tab === "sources") {
    const rows = [
      ["Source", "Candidates", "Interviews", "Hires", "Hire Rate %"],
      ...data.source_effectiveness.map((s) => [
        s.source,
        String(s.candidates),
        String(s.interviews),
        String(s.hires),
        String(s.hire_rate_pct),
      ]),
    ];
    exportCSV("reports-sources.csv", rows);
  } else if (tab === "recruiters") {
    const rows = [
      ["Recruiter", "Candidates", "Interviews", "Hires", "Avg Days"],
      ...data.recruiter_performance.map((r) => [
        r.name,
        String(r.candidates),
        String(r.interviews),
        String(r.hires),
        String(r.avg_days),
      ]),
    ];
    exportCSV("reports-recruiters.csv", rows);
  } else if (tab === "jobs") {
    const rows = [
      ["Job Title", "Applicants", "Conversion %", "Avg Days to Hire", "Status"],
      ...data.job_performance.map((j) => [
        j.title,
        String(j.applicants),
        String(j.conversion_pct),
        String(j.avg_days_to_hire),
        j.status,
      ]),
    ];
    exportCSV("reports-jobs.csv", rows);
  }
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [activeTab, setActiveTab] = useState("overview");

  // Persist active tab across page refreshes
  useEffect(() => {
    const saved = sessionStorage.getItem("reports-tab");
    if (saved) setActiveTab(saved);
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    sessionStorage.setItem("reports-tab", tab);
  }, []);
  const [data, setData] = useState<ReportsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSetPageMetadata({
    title: t("reports_title"),
    subtitle: t("reports_subtitle"),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getReportsSummary(period);
      setData(result);
    } catch {
      setError("Failed to load report data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs"
          disabled={!data}
          onClick={() => data && exportTabData(activeTab, data)}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Loading / Error */}
      {loading && <ReportsSkeleton />}

      {!loading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Main content */}
      {!loading && !error && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {KPI_CONFIG.map(({ key, title, icon, format }) => {
              const metric = data.kpis[key];
              return (
                <KPICard
                  key={key}
                  title={title}
                  value={format(metric.value)}
                  change={metric.change_pct}
                  trend={metric.trend}
                  icon={icon}
                />
              );
            })}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0 mb-4">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="sources"
                className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Sources
              </TabsTrigger>
              <TabsTrigger
                value="recruiters"
                className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Recruiters
              </TabsTrigger>
              <TabsTrigger
                value="jobs"
                className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Jobs
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              {activeTab === "overview" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FunnelSection data={data.pipeline_funnel} />
                    <RecruiterPerformanceCard data={data.recruiter_performance} limit={4} />
                  </div>
                  <TimeMetrics
                    avgTimePerStage={data.time_analytics.avg_time_per_stage}
                    timeToHireTrend={data.time_analytics.time_to_hire_trend}
                  />
                </>
              )}
            </TabsContent>

            {/* Sources Tab */}
            <TabsContent value="sources" className="mt-0">
              {activeTab === "sources" && (
                <SourceEffectivenessSection data={data.source_effectiveness} showTrend />
              )}
            </TabsContent>

            {/* Recruiters Tab */}
            <TabsContent value="recruiters" className="space-y-4 mt-0">
              {activeTab === "recruiters" && (
                <>
                  <RecruiterPerformanceCard data={data.recruiter_performance} />
                  <RecruiterComparisonTable data={data.recruiter_performance} />
                </>
              )}
            </TabsContent>

            {/* Jobs Tab */}
            <TabsContent value="jobs" className="mt-0">
              {activeTab === "jobs" && <JobPerformanceSection data={data.job_performance} />}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
