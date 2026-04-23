"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
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
import { Check, ChevronRight, Copy, Loader2, Mail, Settings } from "lucide-react";
import { toast } from "@onehash/ui/sonner";

import { copyToClipboard } from "@/lib/clipboard";
import { isValidEmail, normalizeEmail } from "@/lib/validation/contact";
import { EmailProviderIcon } from "./EmailProviderIcon";

type JobEmailIntegrationManagerProps = {
  jobId: string;
  onChanged?: () => Promise<void> | void;
};

type ProviderKey = "google" | "microsoft" | "zoho";
type VerificationMode = "link" | "code" | "none";

function GmailPath() {
  return (
    <span className="inline-flex items-center gap-1 align-middle whitespace-nowrap">
      <Mail className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap">Gmail</span>
      <ChevronRight className="h-3 w-3 shrink-0" />
      <Settings className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap">Settings</span>
      <ChevronRight className="h-3 w-3 shrink-0" />
      <span className="whitespace-nowrap">See all settings</span>
      <ChevronRight className="h-3 w-3 shrink-0" />
      <span className="whitespace-nowrap">Forwarding and POP/IMAP</span>
    </span>
  );
}

function getForwardingSteps(
  provider: ProviderKey,
  mailboxType: string | null,
  mode: VerificationMode,
): ReactNode[] {
  const isGooglePersonal = provider === "google" && mailboxType === "personal";
  const isAdaptiveGoogleWorkspace =
    provider === "google" && mailboxType !== "personal" && mode === "none";
  if (isAdaptiveGoogleWorkspace) {
    return [
      "Copy the inbound address shown above.",
      "If you are an admin, add forwarding from Google Workspace admin settings and start using forwarding.",
      <span key="google-workspace-non-admin-step">
        If you are a non-admin user, open <GmailPath />, add the inbound address, then click{" "}
        <span className="font-medium text-foreground">Verify Now</span> when it appears below.
      </span>,
    ];
  }
  if (mode === "none") {
    return [
      "Copy the inbound address shown above.",
      `Open ${provider === "microsoft" ? "Outlook" : isGooglePersonal ? "Google Workspace or Gmail admin" : "your provider"} forwarding settings and add the inbound address.`,
      "Save the forwarding rule.",
      "Forwarding will start after the first forwarded email arrives.",
    ];
  }
  if (mode === "code") {
    return [
      "Copy the inbound address shown above.",
      "Open Zoho forwarding settings, add the inbound address, and click Verify.",
      "Copy the verification code shown below after clicking Verify, then paste it into the Zoho verification popup.",
      "Click Verify to finish setup. Your account will be configured and forwarding will start after Zoho confirmation or the first forwarded email.",
    ];
  }
  return [
    "Copy the inbound address shown above.",
    <span key="gmail-personal-open-path">
      Open <GmailPath />, then add the inbound address.
    </span>,
    <span key="gmail-personal-verify-now">
      Click <span className="font-medium text-foreground">Verify Now</span> when it appears below
      and complete Google verification.
    </span>,
    "Finish Google verification and click I Have Verified.",
  ];
}

export function JobEmailIntegrationManager({ jobId, onChanged }: JobEmailIntegrationManagerProps) {
  const [inboxAddress, setInboxAddress] = useState("");
  const [providerKey, setProviderKey] = useState<ProviderKey | "">("");
  const [mailboxType, setMailboxType] = useState<string | null>(null);
  const [inboxStatus, setInboxStatus] = useState<"inactive" | "pending" | "active">("inactive");
  const [verificationStatus, setVerificationStatus] = useState<
    "pending" | "action_required" | "verified" | "failed"
  >("pending");
  const [expectedVerificationMode, setExpectedVerificationMode] =
    useState<VerificationMode>("link");
  const [activeVerificationMode, setActiveVerificationMode] = useState<VerificationMode>("link");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationActionUrl, setVerificationActionUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxSaving, setInboxSaving] = useState(false);
  const [inboxVerifying, setInboxVerifying] = useState(false);
  const [inboxActivating, setInboxActivating] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [hasInboxConfig, setHasInboxConfig] = useState(false);
  const [copiedForwarding, setCopiedForwarding] = useState(false);

  const resetConfigState = useCallback(
    (message?: string | null) => {
      setHasInboxConfig(false);
      setProviderKey("");
      setMailboxType(null);
      setInboxStatus("inactive");
      setVerificationStatus("pending");
      setExpectedVerificationMode("link");
      setActiveVerificationMode("link");
      setVerificationActionUrl(null);
      setVerificationCode("");
      setVerifyDialogOpen(false);
      setVerificationError(message ?? null);
      void onChanged?.();
    },
    [onChanged],
  );

  const refreshInboxStatus = useCallback(async () => {
    try {
      const config = await getJobEmailIntegrationConfig(jobId);
      if (config.status === "timed_out") {
        resetConfigState("Request timed out after 15 minutes. Please set up forwarding again.");
        return;
      }
      const inbox = config.inbox;
      if (!inbox) return;
      setInboxStatus(inbox.status ?? "inactive");
      setVerificationStatus(inbox.verification_status ?? "pending");
      setProviderKey((inbox.provider_key as ProviderKey) ?? "");
      setMailboxType(inbox.mailbox_type ?? null);
      setExpectedVerificationMode(inbox.expected_verification_mode ?? "link");
      setActiveVerificationMode(inbox.active_verification_mode ?? "link");
      setVerificationError(inbox.verification_error ?? null);
      setVerificationActionUrl(inbox.verification_action_url ?? null);
      setVerificationCode(inbox.verification_code_value ?? "");
    } catch {
      // ignore
    }
  }, [jobId]);

  const forwardingDomain = process.env.NEXT_PUBLIC_SES_MAIL_DOMAIN || "applications.smartats.in";
  const forwardingAddress = `job-${jobId.replace(/-/g, "")}@${forwardingDomain}`;
  const canSaveInbox = !inboxSaving && !inboxLoading && isValidEmail(inboxAddress);
  const isVerificationReady = verificationStatus === "action_required";
  const isVerificationDone = verificationStatus === "verified" || inboxStatus === "active";
  const verificationMode = hasInboxConfig ? activeVerificationMode : expectedVerificationMode;
  const isAdaptiveGoogleWorkspace =
    providerKey === "google" && mailboxType !== "personal" && verificationMode === "none";
  const forwardingSteps = providerKey
    ? getForwardingSteps(providerKey, mailboxType, verificationMode)
    : [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getJobEmailIntegrationConfig(jobId);
        if (!cancelled && config.status === "timed_out") {
          resetConfigState("Request timed out after 15 minutes. Please set up forwarding again.");
          return;
        }
        const inbox = config.inbox;
        if (!cancelled && inbox) {
          setHasInboxConfig(true);
          setInboxAddress(inbox.inbox_address ?? "");
          setProviderKey((inbox.provider_key as ProviderKey) ?? "");
          setMailboxType(inbox.mailbox_type ?? null);
          setInboxStatus(inbox.status ?? "inactive");
          setVerificationStatus(inbox.verification_status ?? "pending");
          setExpectedVerificationMode(inbox.expected_verification_mode ?? "link");
          setActiveVerificationMode(inbox.active_verification_mode ?? "link");
          setVerificationError(inbox.verification_error ?? null);
          setVerificationActionUrl(inbox.verification_action_url ?? null);
          setVerificationCode(inbox.verification_code_value ?? "");
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
    const waitingForEmail =
      hasInboxConfig &&
      !verificationDone &&
      (verificationStatus === "pending" || verificationMode === "code");
    if (!waitingForEmail) return;
    const timer = window.setInterval(refreshInboxStatus, 8000);
    return () => window.clearInterval(timer);
  }, [hasInboxConfig, verificationStatus, inboxStatus, verificationMode, refreshInboxStatus]);

  useEffect(() => {
    const verificationDone = verificationStatus === "verified" || inboxStatus === "active";
    if (!verifyDialogOpen || verificationDone) return;
    const timer = window.setInterval(refreshInboxStatus, 12000);
    return () => window.clearInterval(timer);
  }, [verifyDialogOpen, verificationStatus, inboxStatus, refreshInboxStatus]);

  const handleInboxSave = async () => {
    if (!inboxAddress.trim()) {
      toast.error("Inbox address is required");
      return;
    }
    setInboxSaving(true);
    try {
      const config = await upsertJobEmailIntegrationConfig(jobId, {
        inbox_address: normalizeEmail(inboxAddress),
      });
      await rotateJobEmailIntegrationSecret(jobId);
      const inbox = config.inbox;
      if (inbox) {
        setHasInboxConfig(true);
        setProviderKey((inbox.provider_key as ProviderKey) ?? "");
        setMailboxType(inbox.mailbox_type ?? null);
        setInboxStatus(inbox.status ?? "pending");
        setVerificationStatus(inbox.verification_status ?? "pending");
        setExpectedVerificationMode(inbox.expected_verification_mode ?? "link");
        setActiveVerificationMode(inbox.active_verification_mode ?? "link");
        setVerificationError(inbox.verification_error ?? null);
        setVerificationCode(inbox.verification_code_value ?? "");
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
    resetConfigState();
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

      {!hasInboxConfig ? (
        <InputField
          label="Email"
          value={inboxAddress}
          onChange={(e) => setInboxAddress(e.target.value)}
          placeholder="careers@yourcompany.com"
          className="text-sm h-10 md:h-9"
        />
      ) : null}
      {hasInboxConfig && providerKey ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <EmailProviderIcon provider={providerKey} className="h-4 w-4 shrink-0" />
          <span>{inboxAddress}</span>
        </div>
      ) : null}
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
          {providerKey ? (
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="text-xs font-medium text-foreground">Forwarding setup steps</div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {forwardingSteps.map((step, idx) => (
                  <div key={idx}>
                    {idx + 1}. {step}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {verificationError ? (
            <div className="text-xs text-red-600">Verification error: {verificationError}</div>
          ) : null}
          {!isVerificationDone ? (
            verificationMode === "code" ? (
              <div className="space-y-2">
                <InputField
                  label="Verification Code"
                  value={verificationCode}
                  readOnly
                  placeholder="Waiting for Zoho verification code"
                  className="text-sm h-10 md:h-9"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {verificationStatus === "pending" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Waiting for Zoho verification email...
                    </span>
                  ) : verificationCode.trim() ? (
                    <>
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={async () => {
                          const ok = await copyToClipboard(verificationCode.trim());
                          if (ok) {
                            toast.success("Verification code copied");
                          } else {
                            toast.error("Failed to copy verification code");
                          }
                        }}
                      >
                        Copy Code
                      </Button>
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        Copy this code into the Zoho verification popup. Otter will activate
                        automatically afterward.
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            ) : verificationMode === "none" ? (
              !isAdaptiveGoogleWorkspace && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Waiting for the first forwarded email to activate forwarding automatically...
                </span>
              )
            ) : (
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
            )
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
