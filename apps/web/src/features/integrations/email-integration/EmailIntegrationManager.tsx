"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@/app/providers";
import {
  deleteSmtpConfig,
  getEmailIntegrationConfig,
  getSmtpConfig,
  rotateEmailIntegrationSecret,
  testSmtpConnection,
  upsertEmailIntegrationConfig,
  upsertSmtpConfig,
  verifyCompleteEmailIntegration,
  verifyNowEmailIntegration,
  type OrgSmtpConfigResponse,
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
import { InputField, PasswordField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { Check, CheckCircle2, Copy, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

const PASSWORD_MASK = "••••••••";

function SmtpStatusBadge({ status }: { status: "pending" | "active" | "failed" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Connected
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded border bg-muted text-muted-foreground">
      Not tested
    </span>
  );
}

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

  // ── SMTP outbound state ────────────────────────────────────────────────────
  const [smtpConfig, setSmtpConfig] = useState<OrgSmtpConfigResponse | null>(null);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpEditing, setSmtpEditing] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [smtpUseSsl, setSmtpUseSsl] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getSmtpConfig();
        if (!cancelled) setSmtpConfig(cfg);
      } catch {
        // keep usable
      } finally {
        if (!cancelled) setSmtpLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const populateSmtpForm = (cfg: OrgSmtpConfigResponse) => {
    setSmtpHost(cfg.host);
    setSmtpPort(String(cfg.port));
    setSmtpUsername(cfg.username);
    setSmtpPassword(PASSWORD_MASK);
    setSmtpFromEmail(cfg.from_email);
    setSmtpFromName(cfg.from_name ?? "");
    setSmtpUseTls(cfg.use_tls);
    setSmtpUseSsl(cfg.use_ssl);
  };

  const handleSmtpEdit = () => {
    if (smtpConfig) populateSmtpForm(smtpConfig);
    else {
      setSmtpHost("");
      setSmtpPort("587");
      setSmtpUsername("");
      setSmtpPassword("");
      setSmtpFromEmail("");
      setSmtpFromName("");
      setSmtpUseTls(true);
      setSmtpUseSsl(false);
    }
    setSmtpEditing(true);
  };

  const handleSmtpSave = async () => {
    if (!smtpHost.trim() || !smtpUsername.trim() || !smtpFromEmail.trim()) {
      toast.error("Host, username and from email are required");
      return;
    }
    const portNum = parseInt(smtpPort, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error("Port must be between 1 and 65535");
      return;
    }
    setSmtpSaving(true);
    try {
      const updated = await upsertSmtpConfig({
        host: smtpHost.trim(),
        port: portNum,
        username: smtpUsername.trim(),
        password: smtpPassword === PASSWORD_MASK ? null : smtpPassword || null,
        from_email: smtpFromEmail.trim(),
        from_name: smtpFromName.trim() || null,
        use_tls: smtpUseTls,
        use_ssl: smtpUseSsl,
      });
      setSmtpConfig(updated);
      setSmtpEditing(false);
      toast.success("SMTP config saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save SMTP config");
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleSmtpTest = async () => {
    setSmtpTesting(true);
    try {
      const updated = await testSmtpConnection();
      setSmtpConfig(updated);
      if (updated.status === "active") {
        toast.success("SMTP connection verified successfully");
      } else {
        toast.error(`Connection failed: ${updated.last_test_error ?? "Unknown error"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "SMTP test failed");
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleSmtpDelete = async () => {
    try {
      await deleteSmtpConfig();
      setSmtpConfig(null);
      setSmtpEditing(false);
      toast.success("SMTP config removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove SMTP config");
    }
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
          <div className="w-full">
            <label className="text-xs font-medium text-muted-foreground">
              Inbound Email Address
            </label>
            <div className="relative mt-1">
              <input
                readOnly
                value={forwardingAddress}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm font-mono text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-colors md:text-sm"
              />
              <button
                type="button"
                onClick={handleCopyForwardingAddress}
                className="absolute inset-y-0 right-3 my-auto inline-flex h-4 w-4 items-center justify-center p-0 text-muted-foreground hover:text-foreground transition-colors"
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

      {/* ── SMTP Outbound — only visible once inbound is verified & active ─ */}
      {isVerificationDone && (
      <>
      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Outbound Email (SMTP)</h3>
          <p className="text-xs text-muted-foreground">
            Send emails to candidates from your own address via SMTP.
          </p>
        </div>
        {!smtpLoading && smtpConfig && !smtpEditing && (
          <SmtpStatusBadge status={smtpConfig.status} />
        )}
      </div>

      {smtpLoading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : smtpEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <InputField
              label="SMTP Host"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className="text-sm h-9"
            />
            <InputField
              label="Port"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              placeholder="587"
              className="text-sm h-9"
            />
          </div>
          <InputField
            label="Username"
            value={smtpUsername}
            onChange={(e) => setSmtpUsername(e.target.value)}
            placeholder="careers@yourcompany.com"
            className="text-sm h-9"
          />
          <PasswordField
            label="Password"
            value={smtpPassword}
            onChange={(e) => setSmtpPassword(e.target.value)}
            placeholder={smtpConfig ? "Leave unchanged" : "App password or SMTP password"}
            className="text-sm h-9"
          />
          <div className="grid grid-cols-2 gap-2">
            <InputField
              label="From Email"
              value={smtpFromEmail}
              onChange={(e) => setSmtpFromEmail(e.target.value)}
              placeholder="careers@yourcompany.com"
              className="text-sm h-9"
            />
            <InputField
              label="From Name"
              value={smtpFromName}
              onChange={(e) => setSmtpFromName(e.target.value)}
              placeholder="Careers Team"
              className="text-sm h-9"
            />
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpUseTls}
                onChange={(e) => setSmtpUseTls(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              STARTTLS
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpUseSsl}
                onChange={(e) => setSmtpUseSsl(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              SSL/TLS (port 465)
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              type="button"
              className="text-xs h-8"
              onClick={handleSmtpSave}
              disabled={smtpSaving}
            >
              {smtpSaving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              className="text-xs h-8"
              onClick={() => setSmtpEditing(false)}
              disabled={smtpSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : smtpConfig ? (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>
              <span className="font-medium">Host:</span> {smtpConfig.host}:{smtpConfig.port}
            </div>
            <div>
              <span className="font-medium">From:</span>{" "}
              {smtpConfig.from_name ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` : smtpConfig.from_email}
            </div>
            {smtpConfig.status === "failed" && smtpConfig.last_test_error && (
              <div className="text-red-600 mt-1">{smtpConfig.last_test_error}</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              type="button"
              variant="outline"
              className="text-xs h-8"
              onClick={handleSmtpTest}
              disabled={smtpTesting}
            >
              {smtpTesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  Testing…
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              className="text-xs h-8"
              onClick={handleSmtpEdit}
            >
              Edit
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleSmtpDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          type="button"
          variant="outline"
          className="text-xs h-8"
          onClick={handleSmtpEdit}
        >
          Configure SMTP
        </Button>
      )}
      </>
      )}

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
