"use client";

import { useState, useMemo } from "react";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import { PipelineJobsList } from "@/components/pipeline/PipelineJobsList";
import { MultiSelect } from "@onehash/ui/select";
import { pipelineJobs } from "./data";  
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";

export default function PipelinePage() {
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("pipeline_title"),
    subtitle: t("pipeline_subtitle"),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return pipelineJobs.filter((job) => {
      if (search && !job.title.toLowerCase().includes(search.toLowerCase()) && !job.dept.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(job.status)) return false;
      return true;
    });
  }, [search, statusFilter]);

  const statusOptions = [
    { value: "Open", label: t("open") },
    { value: "Draft", label: t("draft") },
    { value: "Closed", label: t("closed") },
  ];

  const filterContent = (
    <div className="space-y-5 p-1">
      <MultiSelect
        label={t("status")}
        value={statusFilter}
        onValueChange={setStatusFilter}
        options={statusOptions}
        placeholder="All status"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
    </div>
  );

  const hasActiveFilters = statusFilter.length > 0;

  const activeChips: { label: string; clear: () => void }[] = [];
  statusFilter.forEach((s) => activeChips.push({ 
    label: s, 
    clear: () => setStatusFilter((prev) => prev.filter((v) => v !== s)) 
  }));

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      filterContent={filterContent}
      filterTitle="Filter Jobs"
      hasActiveFilters={hasActiveFilters}
      activeChips={activeChips}
      onClearAllFilters={() => setStatusFilter([])}
    >
      <PipelineJobsList jobs={filtered} />
    </MainPagesLayout>
  );
}
