"use client";

import { useState, useMemo } from "react";
import { Button, InputField, Label, Icon, cn } from "@onehash/ui";

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const passwordRules: PasswordRule[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One number or symbol", test: (pw) => /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw) },
];

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [company, setCompany] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ruleResults = useMemo(() => passwordRules.map((r) => r.test(password)), [password]);
  const allRulesPassed = ruleResults.every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }
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
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding panel — desktop only */}
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
            Start hiring<br />smarter today.
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Join modern teams using ATS to streamline recruiting,
            collaborate effortlessly, and find the best talent faster.
          </p>
        </div>
      </div>

      {/* Right auth panel */}
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
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight">Create your account</h2>
              <p className="text-sm text-muted-foreground mt-1">Get started with ATS in seconds</p>
            </div>

            {/* Social */}
            <Button
              variant="outline"
              className="w-full h-10 text-sm font-medium gap-2.5 mb-4"
              type="button"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs text-muted-foreground lg:bg-card">or</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-medium text-muted-foreground">Full name</Label>
                <InputField
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="h-10 text-sm"
                  autoComplete="name"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signupEmail" className="text-xs font-medium text-muted-foreground">Email</Label>
                <InputField
                  id="signupEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-10 text-sm"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signupPassword" className="text-xs font-medium text-muted-foreground">Password</Label>
                <div className="relative">
                  <InputField
                    id="signupPassword"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 text-sm pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <Icon name="eye-off" className="h-4 w-4" /> : <Icon name="eye" className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password rules */}
                {password.length > 0 && (
                  <div className="space-y-1 pt-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    {passwordRules.map((rule, i) => (
                      <div key={rule.label} className="flex items-center gap-2">
                        {ruleResults[i] ? (
                          <Icon name="check" className="h-3 w-3 text-foreground" />
                        ) : (
                          <Icon name="x" className="h-3 w-3 text-muted-foreground/50" />
                        )}
                        <span className={cn(
                          "text-[11px] transition-colors",
                          ruleResults[i] ? "text-foreground" : "text-muted-foreground/60"
                        )}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground">Confirm password</Label>
                <div className="relative">
                  <InputField
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn(
                      "h-10 text-sm pr-10",
                      confirmPassword.length > 0 && !passwordsMatch && "border-destructive/50"
                    )}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <Icon name="eye-off" className="h-4 w-4" /> : <Icon name="eye" className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-[11px] text-destructive animate-in fade-in-0 duration-200">Passwords do not match</p>
                )}
              </div>
              <Button type="submit" className="w-full h-10 text-sm font-medium" disabled={loading}>
                {loading ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : "Create account"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-5">
              Already have an account?{" "}
              <span onClick={() => window.location.href = "/login"} className="text-foreground font-medium hover:underline underline-offset-4">
                Sign in
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
