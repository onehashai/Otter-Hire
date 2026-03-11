"use client";

import { useState } from "react";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import TemplatesList from "@/components/templates/TemplatesList";
import { CreateTemplateModal } from "@/components/templates/components/CreateTemplateModal";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";

export default function TemplatesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useSetPageMetadata({
    title: t("templates_title"),
    subtitle: t("templates_subtitle"),
  });

  return (
    <>
      <MainPagesLayout
        searchValue={search}
        onSearchChange={setSearch}
        actionLabel={t("create")}
        actionIcon="Plus"
        onAction={() => setCreateOpen(true)}
        filterTitle={t("filters")}
        hasActiveFilters={false}
        activeChips={[]}
        onClearAllFilters={() => {}}
      >
        <TemplatesList searchValue={search} onSearchChange={setSearch} />
      </MainPagesLayout>
      <CreateTemplateModal open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
