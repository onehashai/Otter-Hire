"use client";

import { useEffect, useState } from "react";
import { Switch } from "@onehash/ui/switch";
import { Badge } from "@onehash/ui/badge";
import { Alert, AlertDescription } from "@onehash/ui/alert";
import { useTranslation } from "react-i18next";
import { useJobSetup } from "../context";
import { getLinkedInStatus, type LinkedInStatus } from "@/api/linkedin";

type DistributionStatus = "not_posted" | "posting" | "posted" | "failed";

const statusVariant: Record<DistributionStatus, "secondary" | "default" | "destructive"> = {
  not_posted: "secondary",
  posting: "secondary",
  posted: "default",
  failed: "destructive",
};

export default function DistributionPage() {
  const { t } = useTranslation();
  const [linkedinStatus, setLinkedinStatus] = useState<LinkedInStatus | null>(null);
  const [loadingLinkedInStatus, setLoadingLinkedInStatus] = useState(true);
  const { postToLinkedin, setPostToLinkedin, linkedinSyncStatus, linkedinLastError } =
    useJobSetup();

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const status = await getLinkedInStatus();
        if (mounted) setLinkedinStatus(status);
      } catch {
        if (mounted) setLinkedinStatus(null);
      } finally {
        if (mounted) setLoadingLinkedInStatus(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const statusLabel = t(linkedinSyncStatus || "not_posted");
  const isLinkedInReady = Boolean(linkedinStatus?.connected && linkedinStatus?.setup_complete);
  const connectedOrgName = linkedinStatus?.organization?.name;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("post_to_linkedin")}</p>
            <p className="text-xs text-muted-foreground">{t("post_to_linkedin_description")}</p>
          </div>
          <Switch checked={postToLinkedin} onCheckedChange={setPostToLinkedin} />
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{t("linkedin_connection")}</p>
          <Badge variant={isLinkedInReady ? "default" : "secondary"}>
            {loadingLinkedInStatus
              ? t("loading")
              : isLinkedInReady
                ? t("connected")
                : t("not_connected")}
          </Badge>
        </div>
        {connectedOrgName ? (
          <p className="text-xs text-muted-foreground">
            {t("linkedin_company_page")}: {connectedOrgName}
          </p>
        ) : null}
        {!loadingLinkedInStatus && postToLinkedin && !isLinkedInReady ? (
          <Alert>
            <AlertDescription className="text-xs">
              {t("linkedin_setup_required_for_distribution")}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{t("distribution_status")}</p>
          <Badge
            variant={statusVariant[(linkedinSyncStatus || "not_posted") as DistributionStatus]}
          >
            {statusLabel}
          </Badge>
        </div>
        {linkedinLastError ? (
          <p className="text-xs text-destructive">{linkedinLastError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("distribution_status_hint")}</p>
        )}
      </div>
    </div>
  );
}
