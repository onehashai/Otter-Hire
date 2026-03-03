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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

  useEffect(() => {
    const verificationDone = verificationStatus === "verified" || inboxStatus === "active";
    if (!verifyDialogOpen || verificationDone) return;
    const timer = window.setInterval(async () => {
      try {
        const config = await getEmailIntegrationConfig();
        const inbox = config.inbox;
        if (!inbox) return;
        setInboxStatus(inbox.status ?? "inactive");
        setVerificationStatus(inbox.verification_status ?? "pending");
        setVerificationError(inbox.verification_error ?? null);
        setVerificationActionUrl(inbox.verification_action_url ?? null);
      } catch {
        // Keep dialog usable even if one poll fails.
      }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [verifyDialogOpen, verificationStatus, inboxStatus]);

  const forwardingDomain = process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN || "inbound.ottr.ai";
  const forwardingAddress = user?.org_id
    ? `org-${user.org_id.replace(/-/g, "")}@${forwardingDomain}`
    : `org-<org-id>@${forwardingDomain}`;
  const displayedInboxStatus = inboxLoading
    ? "loading"
    : inboxStatus === "active"
      ? "active"
      : verificationStatus;

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
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
        inbox_address: inboxAddress.trim().toLowerCase(),
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
    try {
      await navigator.clipboard.writeText(forwardingAddress);
      setCopiedForwarding(true);
      setTimeout(() => setCopiedForwarding(false), 1500);
      toast.success("Forwarding address copied");
    } catch {
      toast.error("Failed to copy forwarding address");
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Email Integration</h3>
          <p className="text-xs text-muted-foreground">
            Connect careers inbox processing for inbound resumes.
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded border bg-muted">{statusLabel}</span>
      </div>

      <InputField
        label="Careers Email"
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
          >
            {inboxSaving ? "Saving..." : "Save"}
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
          <InputField
            label="Inbound Email Address"
            value={forwardingAddress}
            onChange={() => undefined}
            className="text-sm h-10 md:h-9 font-mono"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              type="button"
              variant="outline"
              className="text-xs h-8"
              onClick={handleCopyForwardingAddress}
            >
              {copiedForwarding ? "Copied" : "Copy"}
            </Button>
            <div className="text-xs text-muted-foreground">
              Configure forwarding from careers email to this inbound address.
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Status: <span className="font-medium uppercase">{displayedInboxStatus}</span>
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
          <DialogFooter className="gap-2 sm:gap-0">
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
