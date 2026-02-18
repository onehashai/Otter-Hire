"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, InputField, Label, Icon } from "@onehash/ui";
import { useTranslation } from "react-i18next";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSent(true);
    startResendTimer();
  };

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
    startResendTimer();
    // Simulate resend
    await new Promise((r) => setTimeout(r, 1000));
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden bg-muted/30">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        <div className="relative z-10 max-w-md px-12">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background text-sm font-bold">A</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">ATS</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight leading-tight mb-3">
            We've got<br />your back.
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Happens to the best of us. Reset your password and get back to building your dream team.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background text-sm font-bold">A</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">ATS</span>
          </div>

          <div className="lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-8 lg:shadow-sm">
            {!sent ? (
              <>
                <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
                  <Icon name="ArrowLeft" className="h-3.5 w-3.5" />
                  Back to login
                </Link>

                <div className="mb-6">
                  <h2 className="text-xl font-semibold tracking-tight">Reset your password</h2>
                  <p className="text-sm text-muted-foreground mt-1">Enter the email associated with your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
                      {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="resetEmail" className="text-xs font-medium text-muted-foreground">{t("email")}</Label>
                    <InputField
                      id="resetEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="h-10 text-sm"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  <Button type="submit" className="w-full h-10 text-sm font-medium" disabled={loading}>
                    {loading ? <Icon name="Loader" className="h-4 w-4 animate-spin" /> : "Send reset link"}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center py-4 animate-in fade-in-0 duration-300">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-5">
                  <Icon name="Mail" className="h-5 w-5 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight mb-2">Check your email</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
                  We've sent a password reset link if an account exists for <span className="text-foreground font-medium">{email}</span>.
                </p>

                <div className="mt-6 space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-10 text-sm"
                    onClick={handleResend}
                    disabled={resendDisabled}
                  >
                    {resendDisabled ? `Resend in ${resendTimer}s` : "Resend email"}
                  </Button>
                  <Link href="/login" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Back to login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
