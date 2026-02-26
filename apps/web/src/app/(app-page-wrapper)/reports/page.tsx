"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@onehash/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Download } from "lucide-react";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import {
  KPICard,
  JobPerformanceSection,
  RecruiterComparisonTable,
  kpiData,
} from "@/components/reports";

export default function ReportsPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState("30d");
  const [activeTab, setActiveTab] = useState("jobs");

  useSetPageMetadata({
    title: t("reports_title"),
    subtitle: t("reports_subtitle"),
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex justify-between w-full">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiData.map((kpi) => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 gap-0 overflow-x-auto no-scrollbar">
          {[
            { value: "jobs", label: "Jobs" },
            { value: "recruiters", label: "Recruiters" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2.5 pt-1 text-xs"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="jobs" className="mt-4 space-y-4">
          <JobPerformanceSection />
        </TabsContent>

        <TabsContent value="recruiters" className="mt-4 space-y-4">
          <RecruiterComparisonTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
