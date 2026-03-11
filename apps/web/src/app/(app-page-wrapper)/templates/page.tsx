"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import TemplatesList from "@/components/templates/TemplatesList";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";

export default function TemplatesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState("");

  useSetPageMetadata({
    title: t("templates_title"),
    subtitle: t("templates_subtitle"),
  });

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      actionLabel={t("create")}
      actionIcon="Plus"
      onAction={() => router.push("/templates/new")}
      filterTitle={t("filters")}
      hasActiveFilters={false}
      activeChips={[]}
      onClearAllFilters={() => {}}
    >
      <TemplatesList searchValue={search} onSearchChange={setSearch} />
    </MainPagesLayout>
  );
}
