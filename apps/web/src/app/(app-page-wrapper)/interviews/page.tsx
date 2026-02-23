"use client";

import { useState, useMemo } from "react";
import { Button } from "@onehash/ui/button";
import { MultiSelect } from "@onehash/ui/select";
import { useTranslation } from "react-i18next";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import { InterviewsList, type Interview } from "@/components/interviews/InterviewsList";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";

const interviews: Interview[] = [
  { candidate: "Alex Rivera", role: "Sr. Frontend Engineer", time: "10:00 AM", interviewer: "Sarah M.", type: "Technical", link: true },
  { candidate: "Jordan Lee", role: "Engineering Manager", time: "11:30 AM", interviewer: "Mike T.", type: "Cultural", link: true },
  { candidate: "Sam Chen", role: "Data Scientist", time: "2:00 PM", interviewer: "Lisa K.", type: "Screening", link: false },
  { candidate: "Emma Wilson", role: "Frontend Engineer", time: "3:30 PM", interviewer: "Sarah M.", type: "Technical", link: true },
];

const interviewTypes = ["Technical", "Cultural", "Screening"];
const interviewers = ["Sarah M.", "Mike T.", "Lisa K."];

const typeOptions = interviewTypes.map((t) => ({ value: t, label: t }));
const interviewerOptions = interviewers.map((i) => ({ value: i, label: i }));

export default function InterviewsPage() {
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("interviews_title"),
    subtitle: t("interviews_subtitle"),
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [interviewerFilter, setInterviewerFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return interviews.filter((interview) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        interview.candidate.toLowerCase().includes(q) ||
        interview.role.toLowerCase().includes(q) ||
        interview.interviewer.toLowerCase().includes(q);
      const matchType = typeFilter.length === 0 || typeFilter.includes(interview.type);
      const matchInterviewer = interviewerFilter.length === 0 || interviewerFilter.includes(interview.interviewer);
      return matchSearch && matchType && matchInterviewer;
    });
  }, [search, typeFilter, interviewerFilter]);

  const activeFiltersCount = typeFilter.length + interviewerFilter.length;

  const clearAllFilters = () => {
    setTypeFilter([]);
    setInterviewerFilter([]);
  };

  const activeChips: { label: string; clear: () => void }[] = [];
  typeFilter.forEach((t) => activeChips.push({ label: `Type: ${t}`, clear: () => setTypeFilter((prev) => prev.filter((v) => v !== t)) }));
  interviewerFilter.forEach((i) => activeChips.push({ label: `Interviewer: ${i}`, clear: () => setInterviewerFilter((prev) => prev.filter((v) => v !== i)) }));

  const filterContent = (
    <div className="space-y-4 p-1">
      <MultiSelect
        label={t("type")}
        value={typeFilter}
        onValueChange={setTypeFilter}
        options={typeOptions}
        placeholder="All types"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
      <MultiSelect
        label={t("interviewer")}
        value={interviewerFilter}
        onValueChange={setInterviewerFilter}
        options={interviewerOptions}
        placeholder="All interviewers"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-muted-foreground" onClick={clearAllFilters}>
          {t("clear_all")}
        </Button>
      )}
    </div>
  );

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      actionLabel={t("schedule")}
      actionIcon="CalendarPlus"
      onAction={() => {}}
      filterContent={filterContent}
      filterTitle={t("filters")}
      hasActiveFilters={activeFiltersCount > 0}
      activeChips={activeChips}
      onClearAllFilters={clearAllFilters}
    >
      <InterviewsList interviews={filtered} />
    </MainPagesLayout>
  );
}
