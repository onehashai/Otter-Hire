"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@/app/providers";
import {
  getEmailIntegrationConfig,
  rotateEmailIntegrationSecret,
  upsertEmailIntegrationConfig,
  verifyCompleteEmailIntegration,
  verifyNowEmailIntegration,
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

type EmailIntegrationManagerProps = {
  onChanged?: () => Promise<void> | void;
};

export function EmailIntegrationManager({ onChanged }: EmailIntegrationManagerProps) {
  const { user } = useAuthSession();
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getEmailIntegrationConfig();
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
  }, []);

  const refreshInboxStatus = async () => {
    try {
      const config = await getEmailIntegrationConfig();
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

  // Poll while the main view is waiting for action_required (verification email not yet arrived).
  useEffect(() => {
    const verificationDone = verificationStatus === "verified" || inboxStatus === "active";
    const waitingForEmail = hasInboxConfig && !verificationDone && verificationStatus === "pending";
    if (!waitingForEmail) return;
    const timer = window.setInterval(refreshInboxStatus, 8000);
    return () => window.clearInterval(timer);
  }, [hasInboxConfig, verificationStatus, inboxStatus]);

  // Poll while the verify dialog is open (waiting for user to complete verification).
  useEffect(() => {
    const verificationDone = verificationStatus === "verified" || inboxStatus === "active";
    if (!verifyDialogOpen || verificationDone) return;
    const timer = window.setInterval(refreshInboxStatus, 12000);
    return () => window.clearInterval(timer);
  }, [verifyDialogOpen, verificationStatus, inboxStatus]);

  const forwardingDomain = process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN || "inbound.smartats.in";
  const forwardingAddress = user?.org_id
    ? `org-${user.org_id.replace(/-/g, "")}@${forwardingDomain}`
    : `org-<org-id>@${forwardingDomain}`;
  const displayedInboxStatus = inboxLoading
    ? "loading"
    : inboxStatus === "active"
      ? "active"
      : verificationStatus;

  const canSaveInbox = !inboxSaving && !inboxLoading && isValidEmail(inboxAddress);
  const isVerificationReady = verificationStatus === "action_required";
  const isVerificationDone = verificationStatus === "verified" || inboxStatus === "active";

  const statusLabel = useMemo(() => {
    if (isVerificationDone) return "Configured";
    if (displayedInboxStatus === "loading") return "Loading";
    return "Pending";
  }, [displayedInboxStatus, isVerificationDone]);

  const handleInboxSave = async () => {
    if (!inboxAddress.trim()) {
      toast.error("Inbox address is required");
      return;
    }
    setInboxSaving(true);
    try {
      const config = await upsertEmailIntegrationConfig({
        inbox_address: normalizeEmail(inboxAddress),
        provider: "ses",
      });
      await rotateEmailIntegrationSecret();
      const inbox = config.inbox;
      if (inbox) {
        setHasInboxConfig(true);
        setInboxStatus(inbox.status ?? "pending");
        setVerificationStatus(inbox.verification_status ?? "pending");
        setVerificationError(inbox.verification_error ?? null);
      }
      setVerificationActionUrl(null);
      toast.success("Email integration saved");
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
      const resp = await verifyNowEmailIntegration();
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
      const resp = await verifyCompleteEmailIntegration();
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
          <div className="w-full">
            <label className="text-xs font-medium text-muted-foreground">
              Inbound Email Address
            </label>
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
                aria-label="Copy forwarding address"
              >
                {copiedForwarding ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
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
              Verified and active. Email ingestion is enabled.
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
              Configured successfully. Inbox is active.
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div>1. Complete provider verification in the opened tab.</div>
              <div>
                2. Return here and click <span className="font-medium">I Have Verified</span>.
              </div>
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
