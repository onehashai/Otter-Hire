
"use client";

import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import TemplatesList from "@/components/templates/TemplatesList";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";

export default function TemplatesPage() {
    const { t } = useTranslation();

    useSetPageMetadata({
        title: t("templates_title"),
        subtitle: t("templates_subtitle"),
    });

    return (
        <MainPagesLayout
            searchValue={""}
            onSearchChange={() => {}}
            actionLabel={t("create")}
            actionIcon="Plus"
            onAction={() => {}}
            filterContent={<></>}
            filterTitle={t("filters")}
            hasActiveFilters={false}
            activeChips={[]}
            onClearAllFilters={() => {}}
        >
            <TemplatesList />
        </MainPagesLayout>
    );
}
