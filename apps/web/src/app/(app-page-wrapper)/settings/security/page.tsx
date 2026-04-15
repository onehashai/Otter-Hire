"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  createPassword,
  disconnectGoogle,
  getSecurityStatus,
  updatePassword,
  type SecurityStatusResponse,
} from "@/api/users";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { PasswordField } from "@onehash/ui/input";
import { Skeleton } from "@onehash/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@onehash/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@onehash/ui/tooltip";
import { toast } from "@onehash/ui/sonner";
import { CheckCircle2, KeyRound } from "lucide-react";
import { API_BASE_URL } from "@/api/client/client";
import { useTranslation } from "react-i18next";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Google Connect Modal ─────────────────────────────────────────────────────

function GoogleConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("google_connect_title")}</DialogTitle>
          <DialogDescription>{t("google_connect_description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              window.location.href = `${API_BASE_URL}/auth/google/link`;
            }}
          >
            {t("continue_to_google")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Google Disconnect Modal ──────────────────────────────────────────────────

function GoogleDisconnectModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("disconnect_google_title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("disconnect_google_description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? t("disconnecting") : t("disconnect")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Password Modal ───────────────────────────────────────────────────────────

function PasswordModal({
  open,
  hasPassword,
  onClose,
  onSuccess,
}: {
  open: boolean;
  hasPassword: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);

    if (newPassword.length < 8) {
      setError(t("password_min_length_error"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwords_do_not_match_error"));
      return;
    }

    setSaving(true);
    try {
      if (hasPassword) {
        if (!currentPassword) {
          setError(t("current_password_required"));
          setSaving(false);
          return;
        }
        await updatePassword(currentPassword, newPassword, confirmPassword);
        toast.success(t("password_updated"));
      } else {
        await createPassword(newPassword, confirmPassword);
        toast.success(t("password_set_success"));
      }
      reset();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasPassword ? t("change_password") : t("set_password")}</DialogTitle>
          <DialogDescription>
            {hasPassword ? t("change_password_description") : t("set_password_description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {hasPassword && (
            <PasswordField
              label={t("current_password_label")}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
          )}
          <PasswordField
            label={t("new_password_label")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
          />
          <PasswordField
            label={t("confirm_password_label")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            autoComplete="new-password"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? t("saving") : hasPassword ? t("update_password") : t("set_password")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SecuritySettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

  const [status, setStatus] = useState<SecurityStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [googleConnectOpen, setGoogleConnectOpen] = useState(false);
  const [googleDisconnectOpen, setGoogleDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await getSecurityStatus();
      setStatus(data);
    } catch {
      toast.error(t("security_load_failed"));
    } finally {
      setLoading(false);
    }
  };

  // Initial load + handle OAuth return params
  useEffect(() => {
    void loadStatus();

    const linked = searchParams.get("linked");
    const linkError = searchParams.get("link_error");

    if (linked === "true") {
      toast.success(t("google_connected_success"));
      router.replace("/settings/security");
    } else if (linkError) {
      toast.error(decodeURIComponent(linkError));
      router.replace("/settings/security");
    }
  }, []);

  // Reload when tab regains focus — handles the case where user returns from
  // Google OAuth redirect and the router cache serves the stale page.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleDisconnectGoogle = async () => {
    setDisconnecting(true);
    try {
      await disconnectGoogle();
      toast.success(t("google_disconnected_success"));
      setGoogleDisconnectOpen(false);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("google_disconnect_failed"));
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <TooltipProvider>
      <h2 className="text-base md:text-lg font-semibold mb-1">{t("security")}</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">{t("manage_sign_in")}</p>

      <div className="space-y-3">
        {/* Google Account Card */}
        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <GoogleIcon className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{t("google_account")}</p>
                  {!loading && status?.google_connected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("connected")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {loading
                    ? t("loading")
                    : status?.google_connected
                      ? t("google_connected_description")
                      : t("google_disconnected_description")}
                </p>
              </div>

              {loading ? (
                <Skeleton className="h-8 w-24 shrink-0" />
              ) : status?.google_connected ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-36 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                        disabled={!status.has_password}
                        onClick={() => setGoogleDisconnectOpen(true)}
                      >
                        {t("disconnect")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!status.has_password && (
                    <TooltipContent side="left" className="max-w-[220px] text-xs">
                      {t("set_password_first_tooltip")}
                    </TooltipContent>
                  )}
                </Tooltip>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-36 shrink-0"
                  onClick={() => setGoogleConnectOpen(true)}
                >
                  {t("connect_google")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Password Card */}
        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <KeyRound size={18} className="text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t("password")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {loading
                    ? t("loading")
                    : status?.has_password
                      ? t("password_card_description_has")
                      : t("password_card_description_no")}
                </p>
              </div>

              {loading ? (
                <Skeleton className="h-8 w-28 shrink-0" />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-36 shrink-0"
                  onClick={() => setPasswordModalOpen(true)}
                >
                  {status?.has_password ? t("change_password") : t("set_password")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <GoogleConnectModal open={googleConnectOpen} onClose={() => setGoogleConnectOpen(false)} />
      <GoogleDisconnectModal
        open={googleDisconnectOpen}
        onClose={() => setGoogleDisconnectOpen(false)}
        onConfirm={handleDisconnectGoogle}
        loading={disconnecting}
      />
      <PasswordModal
        open={passwordModalOpen}
        hasPassword={status?.has_password ?? false}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={() => {
          setPasswordModalOpen(false);
          void loadStatus();
        }}
      />
    </TooltipProvider>
  );
}
