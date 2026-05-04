"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import {
  AutomationsList,
  allStatuses,
  allSpecificTriggers,
  type Automation,
  type AutomationStatus,
} from "@/components/automations/AutomationsList";
import { triggerOptions as builderTriggerOptions } from "@/components/automations/builder/types";
import { CreateAutomationDialog } from "@/components/automations/CreateAutomationDialog";
import { MultiSelect } from "@onehash/ui/select";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";
import { getAutomations } from "@/api/automations";
import { ErrorCard } from "@onehash/ui/card";
import { classifyError } from "@/api/client/client";

const statusOptions = allStatuses.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));
const triggerFilterOptions = allSpecificTriggers;

function mapTriggerKey(triggerLabel: string): string {
  return builderTriggerOptions.find((t) => t.label === triggerLabel)?.id ?? "";
}

export default function AutomationsPage() {
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("automations_title"),
    subtitle: t("automations_subtitle"),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AutomationStatus[]>([]);
  const [triggerFilter, setTriggerFilter] = useState<string[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);
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
        triggerKey: mapTriggerKey(item.trigger_label),
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
          triggerKey: mapTriggerKey(item.trigger_label),
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
          const classified = classifyError(err);
          setError({ message: classified.message, forbidden: classified.forbidden });
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
      if (triggerFilter.length && !triggerFilter.includes(a.triggerKey)) return false;
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
        label={t("trigger", "Trigger")}
        value={triggerFilter}
        onValueChange={(v) => setTriggerFilter(v)}
        options={triggerFilterOptions}
        placeholder="All triggers"
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
  triggerFilter.forEach((key) => {
    const label = triggerFilterOptions.find((o) => o.value === key)?.label ?? key;
    activeChips.push({
      label: `Trigger: ${label}`,
      clear: () => setTriggerFilter((p) => p.filter((v) => v !== key)),
    });
  });

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
        error.forbidden ? (
          <ErrorCard
            icon="ShieldOff"
            title={t("access_denied", "Access Denied")}
            description={t(
              "no_permission",
              "You don't have permission to view this page. Contact your administrator if you think this is a mistake.",
            )}
          />
        ) : (
          <p className="text-sm text-destructive">{error.message}</p>
        )
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
