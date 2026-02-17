"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Icon } from "@onehash/ui";
import { useTranslation } from "react-i18next";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resending, setResending] = useState(false);

  const email = "user@company.com"; // Would come from signup context

  const startResendTimer = () => {
    setResendDisabled(true);
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    setResending(true);
    // startResendTimer();
    await new Promise((r) => setTimeout(r, 1000));
    setResending(false);
  };

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
            <span className="text-foreground font-medium">{email}</span>.
            {t("check_your_inbox_to_continue")}
          </p>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-10 text-sm"
              onClick={handleResend}
              disabled={resendDisabled || resending}
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
