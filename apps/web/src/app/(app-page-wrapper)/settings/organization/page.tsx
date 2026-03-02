"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/app/providers";
import {
  deleteOrganizationAvatar,
  getMyOrgInbox,
  getMyOrganization,
  upsertMyOrgInbox,
  updateOrganization,
  uploadOrganizationAvatar,
  verifyCompleteMyOrgInbox,
  verifyNowMyOrgInbox,
} from "@/api";
import { Card, CardContent } from "@onehash/ui/card";
import { InputField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { Button } from "@onehash/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@onehash/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { Building2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { rotateMyOrgInboxSecret } from "@/api";

export default function OrganizationSettings() {
  const { t } = useTranslation();
  const { user, refreshSession } = useAuthSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalWebsite, setOriginalWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarRemoved, setPendingAvatarRemoved] = useState(false);
  const [avatarFallbackMode, setAvatarFallbackMode] = useState<"initial" | "dummy">("initial");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const avatarModeStorageKey = user?.org_id ? `org_avatar_fallback_mode:${user.org_id}` : null;
  const [saving, setSaving] = useState(false);
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
  const initialTab = searchParams.get("tab") === "careers" ? "careers" : "profile";
  const [activeTab, setActiveTab] = useState<"profile" | "careers">(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab") === "careers" ? "careers" : "profile";
    setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      const orgName = user.org_name || "";
      const orgWebsite = user.org_website || "";
      setName(orgName);
      setWebsite(orgWebsite);
      setOriginalName(orgName);
      setOriginalWebsite(orgWebsite);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await getMyOrganization();
        if (!cancelled) {
          setAvatarUrl(resp.avatar_url ?? null);
          setOriginalAvatarUrl(resp.avatar_url ?? null);
          const persistedMode =
            typeof window !== "undefined" && avatarModeStorageKey
              ? window.localStorage.getItem(avatarModeStorageKey)
              : null;
          if (resp.avatar_url) {
            setAvatarFallbackMode("dummy");
            if (avatarModeStorageKey) {
              window.localStorage.setItem(avatarModeStorageKey, "dummy");
            }
          } else {
            setAvatarFallbackMode(persistedMode === "dummy" ? "dummy" : "initial");
          }
        }
      } catch {
        // keep usable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarModeStorageKey, user?.org_name, user?.org_website]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const inbox = await getMyOrgInbox();
        if (!cancelled && inbox) {
          setHasInboxConfig(true);
          setInboxAddress(inbox.inbox_address ?? "");
          setInboxStatus(inbox.status ?? "inactive");
          setVerificationStatus(inbox.verification_status ?? "pending");
          setVerificationError(inbox.verification_error ?? null);
          setVerificationActionUrl(inbox.verification_action_url ?? null);
        }
      } catch {
        // keep page usable
      } finally {
        if (!cancelled) {
          setInboxLoading(false);
        }
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
        const inbox = await getMyOrgInbox();
        if (!inbox) return;
        setInboxStatus(inbox.status ?? "inactive");
        setVerificationStatus(inbox.verification_status ?? "pending");
        setVerificationError(inbox.verification_error ?? null);
        setVerificationActionUrl(inbox.verification_action_url ?? null);
      } catch {
        // keep dialog usable even if one poll fails
      }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [verifyDialogOpen, verificationStatus, inboxStatus]);

  const avatarDirty =
    pendingAvatarRemoved || pendingAvatarFile !== null || avatarUrl !== originalAvatarUrl;
  const isDirty = name !== originalName || website !== originalWebsite || avatarDirty;
  const canSave = isDirty && name.trim().length > 0 && !saving;

  const getInitial = () => {
    const normalized = name.trim();
    return normalized.charAt(0).toUpperCase() || "O";
  };

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      await updateOrganization({
        name: name.trim(),
        website: website.trim() || null,
      });

      let nextAvatarUrl = avatarUrl;
      if (pendingAvatarRemoved) {
        const removed = await deleteOrganizationAvatar();
        nextAvatarUrl = removed.avatar_url ?? null;
      } else if (pendingAvatarFile) {
        const uploaded = await uploadOrganizationAvatar(pendingAvatarFile);
        nextAvatarUrl = uploaded.avatar_url ?? null;
      }

      await refreshSession(true);

      setOriginalName(name.trim());
      setOriginalWebsite(website.trim());
      setAvatarUrl(nextAvatarUrl ?? null);
      setOriginalAvatarUrl(nextAvatarUrl ?? null);
      if (pendingAvatarRemoved) {
        setAvatarFallbackMode("dummy");
        if (avatarModeStorageKey) {
          window.localStorage.setItem(avatarModeStorageKey, "dummy");
        }
      } else if (pendingAvatarFile) {
        setAvatarFallbackMode("dummy");
        if (avatarModeStorageKey) {
          window.localStorage.setItem(avatarModeStorageKey, "dummy");
        }
      }
      setPendingAvatarFile(null);
      setPendingAvatarRemoved(false);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      if (avatarInputRef.current) avatarInputRef.current.value = "";

      toast.success("Organization settings saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (file: File | undefined) => {
    if (!file) return;
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setAvatarUrl(objectUrl);
    setPendingAvatarFile(file);
    setPendingAvatarRemoved(false);
    setAvatarFallbackMode("dummy");
    toast.success("Organization avatar selected. Click Save to apply.");
  };

  const handleAvatarDelete = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setAvatarUrl(null);
    setAvatarFallbackMode("dummy");
    if (pendingAvatarFile) {
      setPendingAvatarFile(null);
      setPendingAvatarRemoved(false);
    } else {
      setPendingAvatarRemoved(Boolean(originalAvatarUrl));
    }
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    toast.success("Organization avatar removal staged. Click Save to apply.");
  };

  const handleInboxSave = async () => {
    if (!inboxAddress.trim()) {
      toast.error("Inbox address is required");
      return;
    }
    setInboxSaving(true);
    try {
      const resp = await upsertMyOrgInbox({
        inbox_address: inboxAddress.trim().toLowerCase(),
        provider: "ses",
      });
      // Auto-generate inbound secret so SES bridge can sign webhook requests
      // without requiring end-user action in settings.
      await rotateMyOrgInboxSecret();
      setHasInboxConfig(true);
      setInboxStatus(resp.status);
      setVerificationStatus(resp.verification_status ?? "pending");
      setVerificationError(resp.verification_error ?? null);
      setVerificationActionUrl(null);
      toast.success("Careers inbox saved");
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
      const resp = await verifyNowMyOrgInbox();
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
      const resp = await verifyCompleteMyOrgInbox();
      if (resp.status === "active") {
        setInboxStatus("active");
        setVerificationStatus("verified");
        setVerificationError(null);
      }
      toast.success(resp.message || "Inbox verified");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not activate inbox";
      setVerificationError(message);
      toast.error(message);
    } finally {
      setInboxActivating(false);
    }
  };

  const forwardingDomain = process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN || "inbound.ottr.ai";
  const forwardingAddress = user?.org_id
    ? `org-${user.org_id.replace(/-/g, "")}@${forwardingDomain}`
    : `org-<org-id>@${forwardingDomain}`;
  const displayedInboxStatus = inboxLoading
    ? "loading"
    : inboxStatus === "active"
      ? "active"
      : verificationStatus;

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

  const handleTabChange = (nextValue: string) => {
    const nextTab = nextValue === "careers" ? "careers" : "profile";
    setActiveTab(nextTab);
    const nextSearch = new URLSearchParams(searchParams.toString());
    nextSearch.set("tab", nextTab);
    router.replace(`${pathname}?${nextSearch.toString()}`, { scroll: false });
  };

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
  const canSaveInbox = !inboxSaving && !inboxLoading && isValidEmail(inboxAddress);
  const isVerificationReady = verificationStatus === "action_required";
  const isVerificationDone = verificationStatus === "verified" || inboxStatus === "active";
  const handleChangeEmail = () => {
    setHasInboxConfig(false);
    setInboxStatus("inactive");
    setVerificationStatus("pending");
    setVerificationError(null);
    setVerificationActionUrl(null);
    setVerifyDialogOpen(false);
  };

  return (
    <>
      <h2 className="text-base md:text-lg font-semibold mb-1">Organization</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">
        Manage your organization settings
      </p>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0 overflow-x-auto no-scrollbar">
          <TabsTrigger
            value="profile"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 text-sm"
          >
            Organization Profile
          </TabsTrigger>
          <TabsTrigger
            value="careers"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 text-sm"
          >
            Careers Inbox
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardContent className="p-4 md:p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar key={`${avatarUrl ?? "none"}-${avatarFallbackMode}`} className="h-16 w-16">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={name || "Organization"} /> : null}
                  <AvatarFallback
                    forceMount
                    className="text-lg bg-gray-100 border border-gray-300 text-gray-700"
                  >
                    {avatarFallbackMode === "initial" ? (
                      getInitial()
                    ) : (
                      <Building2 className="h-7 w-7 text-muted-foreground" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleAvatarChange(e.target.files?.[0])}
                  />
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Upload
                  </Button>
                  {avatarUrl ? (
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      className="text-xs h-8 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={handleAvatarDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              <Separator />
              <InputField
                label="Organization Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter organization name"
                className="text-sm h-10 md:h-9"
              />
              <InputField
                label="Website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Enter company's website"
                className="text-sm h-10 md:h-9"
              />
              <Separator />
              <Button
                size="sm"
                className="text-xs h-9 md:h-8"
                onClick={handleSave}
                disabled={!canSave}
              >
                {t("save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="careers" className="mt-6">
          <Card>
            <CardContent className="p-4 md:p-5 space-y-4">
              <h3 className="text-sm font-semibold">Careers Inbox</h3>
              <p className="text-xs text-muted-foreground">
                Configure inbound candidate email ingestion for this organization.
              </p>
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
                      Configure forwarding in your email provider from careers email to this inbound
                      address.
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
                  {verificationActionUrl && !isVerificationDone ? (
                    <div className="text-xs text-muted-foreground">
                      Verification link ready. Click <span className="font-medium">Verify Now</span> to
                      open provider confirmation.
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email Verification</DialogTitle>
            <DialogDescription>
              Complete the provider verification in the opened tab, then confirm here.
            </DialogDescription>
          </DialogHeader>

          {isVerificationDone ? (
            <div className="text-sm text-green-600 font-medium">
              Configured successfully. Inbox is active. You can close this window.
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div>1. Complete provider verification in the opened tab.</div>
              <div>2. Return here and click <span className="font-medium">I Have Verified</span>.</div>
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
    </>
  );
}
