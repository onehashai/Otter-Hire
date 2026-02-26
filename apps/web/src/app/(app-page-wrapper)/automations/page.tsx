"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import {
  AutomationsList,
  mockAutomations,
  allStatuses,
  allTriggerTypes,
  triggerTypeLabel,
  type Automation,
  type AutomationStatus,
  type TriggerType,
} from "@/components/automations/AutomationsList";
import { MultiSelect } from "@onehash/ui/select";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";

const statusOptions = allStatuses.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));
const triggerOptions = allTriggerTypes.map((t) => ({ value: t.value, label: t.label }));

export default function AutomationsPage() {
  const { t } = useTranslation();
  const router = useRouter();

  useSetPageMetadata({
    title: t("automations_title"),
    subtitle: t("automations_subtitle"),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AutomationStatus[]>([]);
  const [triggerFilter, setTriggerFilter] = useState<TriggerType[]>([]);
  const [automations, setAutomations] = useState<Automation[]>(mockAutomations);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const filtered = useMemo(() => {
    return automations.filter((a) => {
      if (
        search &&
        !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !a.description.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (statusFilter.length && !statusFilter.includes(a.status)) return false;
      if (triggerFilter.length && !triggerFilter.includes(a.triggerType)) return false;
      return true;
    });
  }, [search, statusFilter, triggerFilter, automations]);

  const hasActiveFilters = statusFilter.length > 0 || triggerFilter.length > 0;

  const filterContent = (
    <div className="space-y-5 p-1">
      <MultiSelect
        label={t("status")}
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as AutomationStatus[])}
        options={statusOptions}
        placeholder="All status"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
      <MultiSelect
        label={t("trigger_type", "Trigger type")}
        value={triggerFilter}
        onValueChange={(v) => setTriggerFilter(v as TriggerType[])}
        options={triggerOptions}
        placeholder="All trigger types"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
    </div>
  );

  const activeChips: { label: string; clear: () => void }[] = [];
  statusFilter.forEach((s) =>
    activeChips.push({
      label: `Status: ${s}`,
      clear: () => setStatusFilter((p) => p.filter((v) => v !== s)),
    }),
  );
  triggerFilter.forEach((tr) =>
    activeChips.push({
      label: `Trigger: ${triggerTypeLabel(tr)}`,
      clear: () => setTriggerFilter((p) => p.filter((v) => v !== tr)),
    }),
  );

  const showEmptyState = automations.length === 0 && !search && !hasActiveFilters;

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      actionLabel={t("create")}
      actionIcon="Plus"
      onAction={() => router.push("/automations/new")}
      secondaryActionLabel={t("templates")}
      secondaryActionIcon="LayoutTemplate"
      onSecondaryAction={() => setTemplatesOpen(true)}
      filterContent={filterContent}
      filterTitle={t("filters")}
      hasActiveFilters={hasActiveFilters}
      activeChips={activeChips}
      onClearAllFilters={() => {
        setStatusFilter([]);
        setTriggerFilter([]);
      }}
    >
      <AutomationsList
        filtered={filtered}
        automations={automations}
        setAutomations={setAutomations}
        showEmptyState={showEmptyState}
        templatesOpen={templatesOpen}
        onTemplatesOpenChange={setTemplatesOpen}
      />
    </MainPagesLayout>
  );
}
