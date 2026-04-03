"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { Icon } from "@onehash/ui/icon";
import { LOGO_SVG_PATH, PLATFORM_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const passwordRules = [
  { label: "At least 8 characters", test: (pw: string) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  {
    label: "One number or symbol",
    test: (pw: string) => /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw),
  },
];

export default function ResetPassword() {
  const router = useRouter();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Simulate checking token validity
  const [tokenValid] = useState(true);

  const ruleResults = useMemo(() => passwordRules.map((r) => r.test(password)), [password]);
  const allRulesPassed = ruleResults.every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!allRulesPassed) {
      setError("Password does not meet the requirements.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSuccess(true);
    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 3000);
  };

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[420px] text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
            <Icon name="CircleAlert" className="h-5 w-5 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight mb-2">Invalid or expired link</h2>
          <p className="text-sm text-muted-foreground mb-6">
            This password reset link is no longer valid. Please request a new one.
          </p>
          <Button asChild className="h-10 text-sm font-medium">
            <Link href="/forgot-password">Request new link</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[420px] text-center animate-in fade-in-0 duration-300">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-5">
            <Icon name="ShieldCheck" className="h-5 w-5 text-foreground" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight mb-2">{t("password_reset")}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Your password has been updated. Redirecting you to login…
          </p>
          <Button asChild variant="outline" className="h-10 text-sm">
            <Link href="/login">Go to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex items-center mb-10 justify-center">
          <Image
            src={LOGO_SVG_PATH}
            alt="Otter"
            width={140}
            height={42}
            className="object-contain"
            priority
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight">Set new password</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a strong password for your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-xs font-medium text-muted-foreground">
                New password
              </Label>
              <div className="relative">
                <InputField
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 text-sm pr-10"
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <Icon name="EyeOff" className="h-4 w-4" />
                  ) : (
                    <Icon name="Eye" className="h-4 w-4" />
                  )}
                </button>
              </div>
              {password.length > 0 && (
                <div className="space-y-1 pt-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  {passwordRules.map((rule, i) => (
                    <div key={rule.label} className="flex items-center gap-2">
                      {ruleResults[i] ? (
                        <Icon name="Check" className="h-3 w-3 text-foreground" />
                      ) : (
                        <Icon name="X" className="h-3 w-3 text-muted-foreground/50" />
                      )}
                      <span
                        className={cn(
                          "text-[11px] transition-colors",
                          ruleResults[i] ? "text-foreground" : "text-muted-foreground/60",
                        )}
                      >
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmNewPassword"
                className="text-xs font-medium text-muted-foreground"
              >
                Confirm password
              </Label>
              <div className="relative">
                <InputField
                  id="confirmNewPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "h-10 text-sm pr-10",
                    confirmPassword.length > 0 && !passwordsMatch && "border-destructive/50",
                  )}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <Icon name="EyeOff" className="h-4 w-4" />
                  ) : (
                    <Icon name="Eye" className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[11px] text-destructive animate-in fade-in-0 duration-200">
                  Passwords do not match
                </p>
              )}
            </div>

            <Button type="submit" className="w-full h-10 text-sm font-medium" disabled={loading}>
              {loading ? <Icon name="Loader" className="h-4 w-4 animate-spin" /> : "Reset password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
