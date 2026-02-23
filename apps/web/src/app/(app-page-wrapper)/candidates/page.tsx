"use client";

import { useState, useMemo } from "react";
import { Button } from "@onehash/ui/button";
import { MultiSelect } from "@onehash/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import { CandidatesList, type Candidate } from "@/components/candidates/CandidatesList";
import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";

const candidates: Candidate[] = [
  { id: "1", name: "Alex Rivera", email: "alex@example.com", role: "Sr. Frontend Engineer", stage: "Interview", rating: 4.5, recruiter: "Sarah Miller", lastActivity: "2h ago", appliedDate: "2025-02-15", tags: ["React", "TypeScript"], source: "LinkedIn", phone: "+1 555-0101", location: "San Francisco, CA" },
  { id: "2", name: "Maria Kim", email: "maria@example.com", role: "Product Designer", stage: "Offer", rating: 4.2, recruiter: "Sarah Miller", lastActivity: "1d ago", appliedDate: "2025-02-10", tags: ["Figma", "UI/UX"], source: "Careers Page", phone: "+1 555-0102", location: "New York, NY" },
  { id: "3", name: "Sam Chen", email: "sam@example.com", role: "Data Scientist", stage: "Screening", rating: 3.8, recruiter: "John Davis", lastActivity: "3h ago", appliedDate: "2025-02-17", tags: ["Python", "ML"], source: "Referral", phone: "+1 555-0103", location: "Austin, TX" },
  { id: "4", name: "Jordan Lee", email: "jordan@example.com", role: "Engineering Manager", stage: "Interview", rating: 4.0, recruiter: "John Davis", lastActivity: "5h ago", appliedDate: "2025-02-12", tags: ["Leadership", "Agile"], source: "LinkedIn", phone: "+1 555-0104", location: "Seattle, WA" },
  { id: "5", name: "Taylor Morgan", email: "taylor@example.com", role: "Marketing Lead", stage: "Applied", rating: 3.5, recruiter: "Sarah Miller", lastActivity: "30m ago", appliedDate: "2025-02-18", tags: ["Growth", "SEO"], source: "Careers Page", phone: "+1 555-0105", location: "Chicago, IL" },
  { id: "6", name: "Casey Brooks", email: "casey@example.com", role: "Sr. Frontend Engineer", stage: "Hired", rating: 4.8, recruiter: "John Davis", lastActivity: "1w ago", appliedDate: "2025-01-20", tags: ["React", "Node.js"], source: "Referral", phone: "+1 555-0106", location: "Denver, CO" },
  { id: "7", name: "Riley Parker", email: "riley@example.com", role: "Product Designer", stage: "Rejected", rating: 2.5, recruiter: "Sarah Miller", lastActivity: "3d ago", appliedDate: "2025-02-05", tags: ["Sketch", "Prototyping"], source: "LinkedIn", phone: "+1 555-0107", location: "Portland, OR" },
];

const stages = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];
const roles = ["Sr. Frontend Engineer", "Product Designer", "Data Scientist", "Engineering Manager", "Marketing Lead"];
const recruiters = ["Sarah Miller", "John Davis"];

const stageOptions = stages.map((s) => ({ value: s, label: s }));
const roleOptions = roles.map((r) => ({ value: r, label: r }));
const recruiterOptions = recruiters.map((r) => ({ value: r, label: r }));
const stageOrder: Record<string, number> = { Applied: 0, Screening: 1, Interview: 2, Offer: 3, Hired: 4, Rejected: 5 };

export default function CandidatesPage() {
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("candidates_title"),
    subtitle: t("candidates_subtitle"),
  });

  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [recruiterFilter, setRecruiterFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sort = "newest"; // default sort: newest applied

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.stage.toLowerCase().includes(q);
      const matchStage = stageFilter.length === 0 || stageFilter.includes(c.stage);
      const matchRole = roleFilter.length === 0 || roleFilter.includes(c.role);
      const matchRecruiter = recruiterFilter.length === 0 || recruiterFilter.includes(c.recruiter);
      return matchSearch && matchStage && matchRole && matchRecruiter;
    });

    list.sort((a, b) => {
      if (sort === "newest") return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime();
      if (sort === "rating") return b.rating - a.rating;
      return (stageOrder[a.stage] ?? 0) - (stageOrder[b.stage] ?? 0);
    });

    return list;
  }, [search, stageFilter, roleFilter, recruiterFilter, sort]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const bulkAction = (action: string) => {
    toast({ title: `${action} applied to ${selected.size} candidate(s)` });
    setSelected(new Set());
  };

  const activeFiltersCount = stageFilter.length + roleFilter.length + recruiterFilter.length;

  const clearAllFilters = () => {
    setStageFilter([]);
    setRoleFilter([]);
    setRecruiterFilter([]);
  };

  const activeChips: { label: string; clear: () => void }[] = [];
  stageFilter.forEach((s) => activeChips.push({ label: `Stage: ${s}`, clear: () => setStageFilter((prev) => prev.filter((v) => v !== s)) }));
  roleFilter.forEach((r) => activeChips.push({ label: `Role: ${r}`, clear: () => setRoleFilter((prev) => prev.filter((v) => v !== r)) }));
  recruiterFilter.forEach((r) => activeChips.push({ label: `Recruiter: ${r}`, clear: () => setRecruiterFilter((prev) => prev.filter((v) => v !== r)) }));

  const filterContent = (
    <div className="space-y-4 p-1">
      <MultiSelect
        label="Stage"
        value={stageFilter}
        onValueChange={setStageFilter}
        options={stageOptions}
        placeholder="All stages"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
      <MultiSelect
        label="Job Role"
        value={roleFilter}
        onValueChange={setRoleFilter}
        options={roleOptions}
        placeholder="All roles"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
      <MultiSelect
        label="Recruiter"
        value={recruiterFilter}
        onValueChange={setRecruiterFilter}
        options={recruiterOptions}
        placeholder="All recruiters"
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
      actionLabel="Add"
      actionIcon="UserPlus"
      onAction={() => toast({ title: "Add Candidate" })}
      filterContent={filterContent}
      filterTitle="Filters"
      hasActiveFilters={activeFiltersCount > 0}
      activeChips={activeChips}
      onClearAllFilters={clearAllFilters}
    >
      <CandidatesList
        candidates={filtered}
        selected={selected}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleAll}
        onBulkAction={bulkAction}
        onClearSelection={() => setSelected(new Set())}
      />
    </MainPagesLayout>
  );
}
