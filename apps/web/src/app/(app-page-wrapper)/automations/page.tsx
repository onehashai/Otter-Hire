"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import {
  AutomationsList,
  allStatuses,
  allTriggerTypes,
  triggerTypeLabel,
  type Automation,
  type AutomationStatus,
  type TriggerType,
} from "@/components/automations/AutomationsList";
import { CreateAutomationDialog } from "@/components/automations/CreateAutomationDialog";
import { MultiSelect } from "@onehash/ui/select";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";
import { getAutomations } from "@/api/automations";

const statusOptions = allStatuses.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));
const triggerOptions = allTriggerTypes.map((t) => ({ value: t.value, label: t.label }));

export default function AutomationsPage() {
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("automations_title"),
    subtitle: t("automations_subtitle"),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AutomationStatus[]>([]);
  const [triggerFilter, setTriggerFilter] = useState<TriggerType[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialTemplate, setCreateInitialTemplate] = useState<
    | {
        name: string;
        triggerKey: string;
        triggerConfig?: Record<string, unknown>;
        templateId?: string;
      }
    | undefined
  >(undefined);

  const refreshAutomations = useCallback(async () => {
    try {
      const items = await getAutomations();
      const mapped: Automation[] = items.map((item) => ({
        id: item.id,
        name: item.name,
        status: (item.status as AutomationStatus) ?? "active",
        triggerType: (item.trigger_type as TriggerType) ?? "candidate",
        triggerLabel: item.trigger_label,
        actionLabel: item.action_label,
        scope: item.scope,
        lastTriggered: item.last_run_at,
        createdBy: item.created_by_name ?? "",
        createdAt: item.created_at,
        executionCount: item.execution_count ?? 0,
      }));
      setAutomations(mapped);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await getAutomations();
        if (cancelled) return;
        const mapped: Automation[] = items.map((item) => ({
          id: item.id,
          name: item.name,
          status: (item.status as AutomationStatus) ?? "active",
          triggerType: (item.trigger_type as TriggerType) ?? "candidate",
          triggerLabel: item.trigger_label,
          actionLabel: item.action_label,
          scope: item.scope,
          lastTriggered: item.last_run_at,
          createdBy: item.created_by_name ?? "",
          createdAt: item.created_at,
          executionCount: item.execution_count ?? 0,
        }));
        setAutomations(mapped);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Failed to load automations.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return automations.filter((a) => {
      if (
        search &&
        !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !a.triggerLabel.toLowerCase().includes(search.toLowerCase()) &&
        !a.actionLabel.toLowerCase().includes(search.toLowerCase())
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

  const showEmptyState =
    !loading && !error && automations.length === 0 && !search && !hasActiveFilters;

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      actionLabel={t("create")}
      actionIcon="Plus"
      onAction={() => {
        setCreateInitialTemplate(undefined);
        setCreateOpen(true);
      }}
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
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <AutomationsList
          filtered={filtered}
          automations={automations}
          setAutomations={setAutomations}
          showEmptyState={showEmptyState}
          templatesOpen={templatesOpen}
          onTemplatesOpenChange={setTemplatesOpen}
          onCreateClick={() => {
            setCreateInitialTemplate(undefined);
            setCreateOpen(true);
          }}
          onSelectTemplate={(config) => {
            setTemplatesOpen(false);
            setCreateInitialTemplate({
              name: config.name,
              triggerKey: config.triggerKey,
              triggerConfig: config.triggerConfig,
              templateId: config.templateId,
            });
            setCreateOpen(true);
          }}
        />
      )}

      <CreateAutomationDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateInitialTemplate(undefined);
        }}
        onCreated={refreshAutomations}
        initialTemplate={createInitialTemplate}
      />
    </MainPagesLayout>
  );
}
