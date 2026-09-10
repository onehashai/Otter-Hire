"use client";

import { useEffect, useState } from "react";
import { Switch } from "@onehash/ui/switch";
import { Badge } from "@onehash/ui/badge";
import { Alert, AlertDescription } from "@onehash/ui/alert";
import { Button } from "@onehash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { Clock, Trash2 } from "lucide-react";
import { toast } from "@onehash/ui/sonner";
import { useTranslation } from "react-i18next";
import { useJobSetup } from "../context";
import { getLinkedInStatus, type LinkedInStatus } from "@/api/linkedin";
import {
  disconnectJobEmailIntegration,
  getJobEmailIntegrationConfig,
  type JobIntegrationEmailConfigResponse,
} from "@/api";
import { JobEmailIntegrationManager } from "@/features/integrations/email-integration/JobEmailIntegrationManager";

export default function IntegrationPage() {
  const { t } = useTranslation();
  const [linkedinStatus, setLinkedinStatus] = useState<LinkedInStatus | null>(null);
  const [loadingLinkedInStatus, setLoadingLinkedInStatus] = useState(true);
  const [emailStatus, setEmailStatus] = useState<JobIntegrationEmailConfigResponse | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { jobId, isLoading, postToLinkedin, setPostToLinkedin } = useJobSetup();

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
  const isEmailPendingVerification =
    emailStatus?.configured === true && emailStatus?.status === "pending";

  const fetchEmailStatus = async () => {
    if (!jobId) {
      setEmailStatus(null);
      return;
    }
    try {
      const status = await getJobEmailIntegrationConfig(jobId);
      setEmailStatus(status);
    } catch {
      setEmailStatus(null);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    void fetchEmailStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return (
    <div className="relative">
      <div className="space-y-5">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{t("email_integration")}</p>
                <Badge variant={emailStatus?.status === "active" || isEmailPendingVerification ? "default" : "secondary"}>
                  {emailStatus?.status === "active" || isEmailPendingVerification
                    ? t("connected")
                    : t("not_connected")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t("email_integration_description")}</p>
            </div>
            <div className="flex items-center gap-2">
              {emailStatus?.configured ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setDisconnectConfirmOpen(true)}
                  disabled={disconnecting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                size="sm"
                className="h-8"
                onClick={() => setEmailDialogOpen(true)}
                disabled={isLoading || !jobId}
              >
                {emailStatus?.configured || isEmailPendingVerification
                    ? t("manage")
                    : t("connect")}
              </Button>
            </div>
          </div>
        </div>
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
            {/* TODO(job-integrations): Remove the sr-only Switch + Coming Soon Button; render only <Switch checked={postToLinkedin} onCheckedChange={setPostToLinkedin} /> in this flex (same wrapper as Email row). */}
            <div className="flex items-center gap-2">
              <span className="sr-only">
                <Switch checked={postToLinkedin} onCheckedChange={setPostToLinkedin} />
              </span>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 disabled:opacity-100"
                disabled
                tabIndex={-1}
              >
                <Clock className="h-4 w-4 shrink-0" aria-hidden />
                Coming soon
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("job_email_integration")}</DialogTitle>
            <DialogDescription>{t("job_email_integration_description")}</DialogDescription>
          </DialogHeader>
          {jobId ? (
            <JobEmailIntegrationManager
              jobId={jobId}
              onChanged={async () => {
                await fetchEmailStatus();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={disconnectConfirmOpen} onOpenChange={setDisconnectConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("disconnect_job_email_title")}</DialogTitle>
            <DialogDescription>{t("disconnect_email_integration_description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              pending={disconnecting}
              onClick={async () => {
                setDisconnecting(true);
                try {
                  if (!jobId) throw new Error("Job is still loading");
                  await disconnectJobEmailIntegration(jobId);
                  toast.success(t("email_integration_disconnected"));
                  setDisconnectConfirmOpen(false);
                  await fetchEmailStatus();
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : "Failed to disconnect integration";
                  toast.error(message);
                } finally {
                  setDisconnecting(false);
                }
              }}
            >
              {t("disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
