"use client";

import { useEffect, useState } from "react";
import {
  getJobEmailIntegrationConfig,
  rotateJobEmailIntegrationSecret,
  upsertJobEmailIntegrationConfig,
  verifyCompleteJobEmailIntegration,
  verifyNowJobEmailIntegration,
} from "@/api";
import { Button } from "@onehash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { InputField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "@onehash/ui/sonner";

import { copyToClipboard } from "@/lib/clipboard";
import { isValidEmail, normalizeEmail } from "@/lib/validation/contact";

type JobEmailIntegrationManagerProps = {
  jobId: string;
  onChanged?: () => Promise<void> | void;
};

export function JobEmailIntegrationManager({ jobId, onChanged }: JobEmailIntegrationManagerProps) {
  const [inboxAddress, setInboxAddress] = useState("");
  const [inboxStatus, setInboxStatus] = useState<"inactive" | "pending" | "active">("inactive");
  const [verificationStatus, setVerificationStatus] = useState<
    "pending" | "action_required" | "verified" | "failed"
  >("pending");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationActionUrl, setVerificationActionUrl] = useState<string | null>(null);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxSaving, setInboxSaving] = useState(false);
  const [inboxVerifying, setInboxVerifying] = useState(false);
  const [inboxActivating, setInboxActivating] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [hasInboxConfig, setHasInboxConfig] = useState(false);
  const [copiedForwarding, setCopiedForwarding] = useState(false);

  const refreshInboxStatus = async () => {
    try {
      const config = await getJobEmailIntegrationConfig(jobId);
      const inbox = config.inbox;
      if (!inbox) return;
      setInboxStatus(inbox.status ?? "inactive");
      setVerificationStatus(inbox.verification_status ?? "pending");
      setVerificationError(inbox.verification_error ?? null);
      setVerificationActionUrl(inbox.verification_action_url ?? null);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getJobEmailIntegrationConfig(jobId);
        const inbox = config.inbox;
        if (!cancelled && inbox) {
          setHasInboxConfig(true);
          setInboxAddress(inbox.inbox_address ?? "");
          setInboxStatus(inbox.status ?? "inactive");
          setVerificationStatus(inbox.verification_status ?? "pending");
          setVerificationError(inbox.verification_error ?? null);
          setVerificationActionUrl(inbox.verification_action_url ?? null);
        }
      } catch {
        // Keep page usable.
      } finally {
        if (!cancelled) setInboxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    const verificationDone = verificationStatus === "verified" || inboxStatus === "active";
    const waitingForEmail = hasInboxConfig && !verificationDone && verificationStatus === "pending";
    if (!waitingForEmail) return;
    const timer = window.setInterval(refreshInboxStatus, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInboxConfig, verificationStatus, inboxStatus]);

  useEffect(() => {
    const verificationDone = verificationStatus === "verified" || inboxStatus === "active";
    if (!verifyDialogOpen || verificationDone) return;
    const timer = window.setInterval(refreshInboxStatus, 12000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyDialogOpen, verificationStatus, inboxStatus]);

  const forwardingDomain = process.env.NEXT_PUBLIC_SES_MAIL_DOMAIN || "applications.smartats.in";
  const forwardingAddress = `job-${jobId.replace(/-/g, "")}@${forwardingDomain}`;
  const canSaveInbox = !inboxSaving && !inboxLoading && isValidEmail(inboxAddress);
  const isVerificationReady = verificationStatus === "action_required";
  const isVerificationDone = verificationStatus === "verified" || inboxStatus === "active";
  const forwardingSteps = [
    "Copy the inbound address shown above.",
    "Open your email provider settings and find forwarding settings.",
    "Add the inbound address as a forwarding destination and complete the provider identity check.",
    "Return to Otter and wait until the Verify Now button becomes available.",
    "Click Verify Now, finish the provider confirmation in the opened window, then return here.",
    "Click I Have Verified to activate forwarding in Otter.",
    "Go back to your email provider and enable forwarding to the verified inbound address.",
  ];

  const handleInboxSave = async () => {
    if (!inboxAddress.trim()) {
      toast.error("Inbox address is required");
      return;
    }
    setInboxSaving(true);
    try {
      const config = await upsertJobEmailIntegrationConfig(jobId, {
        inbox_address: normalizeEmail(inboxAddress),
        provider: "ses",
      });
      await rotateJobEmailIntegrationSecret(jobId);
      const inbox = config.inbox;
      if (inbox) {
        setHasInboxConfig(true);
        setInboxStatus(inbox.status ?? "pending");
        setVerificationStatus(inbox.verification_status ?? "pending");
        setVerificationError(inbox.verification_error ?? null);
      }
      setVerificationActionUrl(null);
      toast.success("Job email integration saved");
      await onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save inbox";
      toast.error(message);
    } finally {
      setInboxSaving(false);
    }
  };

  const handleVerifyNow = async () => {
    setInboxVerifying(true);
    try {
      const resp = await verifyNowJobEmailIntegration(jobId);
      if (resp.action_url) {
        setVerificationActionUrl(resp.action_url);
        window.open(resp.action_url, "_blank", "noopener,noreferrer");
        setVerifyDialogOpen(true);
      }
      toast.success(resp.message || "Open verification link");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setVerificationStatus("failed");
      setVerificationError(message);
      toast.error(message);
    } finally {
      setInboxVerifying(false);
    }
  };

  const handleVerificationComplete = async () => {
    setInboxActivating(true);
    try {
      const resp = await verifyCompleteJobEmailIntegration(jobId);
      if (resp.status === "active") {
        setInboxStatus("active");
        setVerificationStatus("verified");
        setVerificationError(null);
      }
      toast.success(resp.message || "Inbox verified");
      await onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not activate inbox";
      setVerificationError(message);
      toast.error(message);
    } finally {
      setInboxActivating(false);
    }
  };

  const handleCopyForwardingAddress = async () => {
    const ok = await copyToClipboard(forwardingAddress);
    if (ok) {
      setCopiedForwarding(true);
      setTimeout(() => setCopiedForwarding(false), 1500);
      toast.success("Copied to clipboard");
    } else {
      toast.error("Failed to copy");
    }
  };

  const handleChangeEmail = () => {
    setHasInboxConfig(false);
    setInboxStatus("inactive");
    setVerificationStatus("pending");
    setVerificationError(null);
    setVerificationActionUrl(null);
    setVerifyDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="w-full">
        <label className="text-xs font-medium text-muted-foreground">Inbound Address</label>
        <div className="relative mt-1">
          <input
            readOnly
            value={forwardingAddress}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-11 text-sm font-mono text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-colors md:text-sm"
          />
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              await handleCopyForwardingAddress();
            }}
            className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 shrink-0 items-center justify-center rounded border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Copy inbound address"
          >
            {copiedForwarding ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          This address always receives inbound candidate emails directly for this job. Connect
          forwarding below only if you want another mailbox to forward messages here automatically.
        </p>
      </div>

      <InputField
        label="Email"
        value={inboxAddress}
        onChange={(e) => setInboxAddress(e.target.value)}
        placeholder="careers@yourcompany.com"
        className="text-sm h-10 md:h-9"
        disabled={hasInboxConfig}
      />
      <div className="flex flex-wrap gap-2">
        {!hasInboxConfig ? (
          <Button
            size="sm"
            type="button"
            className="text-xs h-8"
            onClick={handleInboxSave}
            disabled={!canSaveInbox}
            pending={inboxSaving}
          >
            Save
          </Button>
        ) : (
          <Button
            size="sm"
            type="button"
            variant="outline"
            className="text-xs h-8"
            onClick={handleChangeEmail}
          >
            Change Email
          </Button>
        )}
      </div>

      {hasInboxConfig ? (
        <>
          <Separator />
          <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="text-xs font-medium text-foreground">Forwarding setup steps</div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {forwardingSteps.map((step, idx) => (
                <div key={step}>
                  {idx + 1}. {step}
                </div>
              ))}
            </div>
          </div>
          {verificationError ? (
            <div className="text-xs text-red-600">Verification error: {verificationError}</div>
          ) : null}
          {!isVerificationDone ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                type="button"
                variant="outline"
                className="text-xs h-8"
                onClick={handleVerifyNow}
                disabled={!isVerificationReady || inboxVerifying}
              >
                {inboxVerifying ? "Opening..." : "Verify Now"}
              </Button>
              {!isVerificationReady ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Waiting for verification email from provider...
                </span>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-green-600 font-medium">
              Verified and active. Forwarding is enabled. The inbound address above continues to
              accept direct candidate emails for this job.
            </div>
          )}
        </>
      ) : null}

      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email Verification</DialogTitle>
            <DialogDescription>
              Complete provider verification in the opened tab, then confirm here.
            </DialogDescription>
          </DialogHeader>
          {isVerificationDone ? (
            <div className="text-sm text-green-600 font-medium">
              Configured successfully. Forwarding is active.
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {forwardingSteps.slice(4, 6).map((step, idx) => (
                <div key={step}>
                  {idx + 1}. {step}
                </div>
              ))}
              {verificationError ? <div className="text-red-600">{verificationError}</div> : null}
            </div>
          )}
          <DialogFooter>
            {!isVerificationDone && verificationActionUrl ? (
              <Button
                type="button"
                variant="outline"
                className="text-xs h-8"
                onClick={() => window.open(verificationActionUrl, "_blank", "noopener,noreferrer")}
              >
                Open Link Again
              </Button>
            ) : null}
            {!isVerificationDone ? (
              <Button
                type="button"
                className="text-xs h-8"
                onClick={handleVerificationComplete}
                disabled={inboxActivating}
              >
                {inboxActivating ? "Confirming..." : "I Have Verified"}
              </Button>
            ) : (
              <Button
                type="button"
                className="text-xs h-8"
                onClick={() => setVerifyDialogOpen(false)}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
