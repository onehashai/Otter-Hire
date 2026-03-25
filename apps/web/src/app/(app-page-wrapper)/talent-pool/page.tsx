"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import {
  getCandidatesPaginated,
  getJobs,
  type CandidateListItemResponse,
  type JobListItemResponse,
} from "@/api";
import { TalentPoolCandidateList } from "@/components/candidates/talent_pool/TalentPoolCandidateList";
import { Button } from "@onehash/ui/button";
import { EmptyCard, ErrorCard } from "@onehash/ui/card";

const PAGE_SIZE = 50;
const EMAIL_SOURCE = "Email";

export default function TalentPoolPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [items, setItems] = useState<CandidateListItemResponse[]>([]);
  const [jobs, setJobs] = useState<JobListItemResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSetPageMetadata({
    title: t("talent_pool_title"),
    subtitle: t("talent_pool_subtitle"),
  });

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await getCandidatesPaginated({
        source: EMAIL_SOURCE,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getJobs();
        if (!cancelled) setJobs(list);
      } catch {
        if (!cancelled) setJobs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = async () => {
    if (items.length >= total || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getCandidatesPaginated({
        source: EMAIL_SOURCE,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candidates");
    } finally {
      setLoadingMore(false);
    }
  };

  if (error && items.length === 0 && !loading) {
    return (
      <ErrorCard
        icon="CircleAlert"
        title={t("error")}
        description={error}
        actionLabel={t("retry")}
        onAction={() => void refresh()}
      />
    );
  }

  return (
    <MainPagesLayout searchValue={search} onSearchChange={setSearch}>
      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyCard icon="Mail" title={t("talent_pool_title")} description={t("talent_pool_empty")} />
      ) : (
        <>
          <div className="space-y-2">
            {items.map((c) => (
              <TalentPoolCandidateList
                key={c.id}
                candidate={c}
                jobs={jobs}
                onListChange={() => void refresh()}
              />
            ))}
          </div>
          {items.length < total && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? t("loading") : t("load_more")}
              </Button>
            </div>
          )}
        </>
      )}
    </MainPagesLayout>
  );
}
