"use client";

import { useEffect, useState } from "react";
import { Switch } from "@onehash/ui/switch";
import { Badge } from "@onehash/ui/badge";
import { Alert, AlertDescription } from "@onehash/ui/alert";
import { useTranslation } from "react-i18next";
import { useJobSetup } from "../context";
import { getLinkedInStatus, type LinkedInStatus } from "@/api/linkedin";

export default function IntegrationPage() {
  const { t } = useTranslation();
  const [linkedinStatus, setLinkedinStatus] = useState<LinkedInStatus | null>(null);
  const [loadingLinkedInStatus, setLoadingLinkedInStatus] = useState(true);
  const { postToLinkedin, setPostToLinkedin } = useJobSetup();

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

  const isLinkedInReady = Boolean(linkedinStatus?.connected && linkedinStatus?.setup_complete);

  return (
    <div className="relative">
      <div className="space-y-5">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{t("post_to_linkedin")}</p>
                <Badge variant={isLinkedInReady ? "default" : "secondary"}>
                  {loadingLinkedInStatus
                    ? t("loading")
                    : isLinkedInReady
                      ? t("connected")
                      : t("not_connected")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t("post_to_linkedin_description")}</p>
              {!loadingLinkedInStatus && postToLinkedin && !isLinkedInReady ? (
                <Alert className="mt-2">
                  <AlertDescription className="text-xs">
                    {t("linkedin_setup_required_for_distribution")}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
            <Switch checked={postToLinkedin} onCheckedChange={setPostToLinkedin} />
          </div>
        </div>
      </div>

    </div>
  );
}
