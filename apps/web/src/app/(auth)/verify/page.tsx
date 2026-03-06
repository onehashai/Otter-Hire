"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import { useTranslation } from "react-i18next";
import { verifyEmail, resendVerification } from "@/api/index";
import { useAuthSession } from "@/app/providers";

function VerifyEmailContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshSession } = useAuthSession();
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const verifiedTokenRef = useRef<string | null>(null);

  const handleVerify = useCallback(
    async (token: string) => {
      setVerifying(true);
      setError(null);
      try {
        await verifyEmail(token);
        sessionStorage.removeItem("signup_email");
        const inviteToken = sessionStorage.getItem("invite_token");
        sessionStorage.removeItem("invite_token");
        await refreshSession();
        localStorage.setItem("session_updated", Date.now().toString());

        // Verification does not always imply an authenticated cookie in this browser session
        // (e.g. user opened email link in a different browser/incognito). In that case,
        // send user to login with a success hint and continue normal post-login routing.
        if (!user) {
          router.replace("/login?verified=1");
          return;
        }

        if (inviteToken) {
          router.replace(`/invite/${encodeURIComponent(inviteToken)}`);
        } else {
          router.replace("/onboarding");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
        setError(message);
        setVerifying(false);
      }
    },
    [refreshSession, router, user],
  );

  useEffect(() => {
    const inviteToken = sessionStorage.getItem("invite_token");
    if (user?.is_verified && !user?.is_onboarded) {
      if (inviteToken) {
        router.replace(`/invite/${encodeURIComponent(inviteToken)}`);
      } else {
        router.replace("/onboarding");
      }
      return;
    }
    if (user?.is_verified && user?.is_onboarded) {
      // TODO(mvp-nav): Restore dashboard/home redirect after MVP launch.
      // router.replace("/");
      router.replace("/");
      return;
    }

    const storedEmail = sessionStorage.getItem("signup_email");
    if (storedEmail) {
      setEmail(storedEmail);
    }

    const storedTimer = sessionStorage.getItem("resend_timer");
    if (storedTimer) {
      const remaining = parseInt(storedTimer, 10) - Math.floor(Date.now() / 1000);
      if (remaining > 0) {
        setResendTimer(remaining);
        setResendDisabled(true);
        startResendTimer(remaining);
      }
    }

    const token = searchParams.get("token");
    if (token && verifiedTokenRef.current !== token) {
      verifiedTokenRef.current = token;
      handleVerify(token);
    }
  }, [handleVerify, router, searchParams, user?.is_onboarded, user?.is_verified]);

  const startResendTimer = (initialSeconds = 30) => {
    setResendDisabled(true);
    setResendTimer(initialSeconds);
    const expiresAt = Math.floor(Date.now() / 1000) + initialSeconds;
    sessionStorage.setItem("resend_timer", expiresAt.toString());

    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setResendDisabled(false);
          sessionStorage.removeItem("resend_timer");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    try {
      await resendVerification(email);
      startResendTimer();
    } catch (err) {
      setError("Failed to resend email");
    } finally {
      setResending(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-[420px] text-center">
          <Icon name="Loader" className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-4">Verifying your email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[420px] text-center">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background text-sm font-bold">A</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">ATS</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-5">
            <Icon name="Mail" className="h-5 w-5 text-muted-foreground" />
          </div>

          <h2 className="text-xl font-semibold tracking-tight mb-2">{t("verify_your_email")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto mb-6">
            {t("we_ve_sent_a_verification_link_to")}{" "}
            {email && <span className="text-foreground font-medium">{email}</span>}.
            {t("check_your_inbox_to_continue")}
          </p>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive mb-4">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-10 text-sm"
              onClick={handleResend}
              disabled={resendDisabled || resending || !email}
            >
              {resending ? (
                <Icon name="Loader" className="h-4 w-4 animate-spin" />
              ) : resendDisabled ? (
                `Resend in ${resendTimer}s`
              ) : (
                t("resend_verification_email")
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            <Link href="/login" className="hover:text-foreground transition-colors">
              {t("back_to_login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
          <div className="w-full max-w-[420px] text-center">
            <Icon name="Loader" className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
