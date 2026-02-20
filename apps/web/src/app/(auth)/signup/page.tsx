"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  InputField,
  PasswordField,
  Form,
  FormField,
  FormItem,
  FormControl,
  Icon,
} from "@onehash/ui";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { signupSchema, type SignupFormValues } from "@/lib/schemas/zodResolver";
import { signup } from "@/api/index";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (pw: string) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  {
    label: "One number or symbol",
    test: (pw: string) => /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
  },
] as const;

export default function Signup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const inviteToken = searchParams.get("invite");

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");
  const ruleResults = PASSWORD_RULES.map((r) => r.test(password ?? ""));
  const loading = form.formState.isSubmitting;

  const onSubmit = async (data: SignupFormValues) => {
    form.clearErrors("root");
    try {
      await signup({
        email: data.email,
        password: data.password,
      });
      sessionStorage.setItem("signup_email", data.email);
      if (typeof inviteToken === "string" && inviteToken.trim()) {
        sessionStorage.setItem("invite_token", inviteToken.trim());
      }
      router.replace("/verify");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign up";
      form.setError("root", { message });
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden bg-muted/30">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10 max-w-md px-12">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background text-sm font-bold">A</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">ATS</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight leading-tight mb-3">
            Start hiring
            <br />
            smarter today.
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Join modern teams using ATS to streamline recruiting, collaborate
            effortlessly, and find the best talent faster.
          </p>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background text-sm font-bold">A</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">ATS</span>
          </div>

          <div className="lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-8 lg:shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight">
                Create your account
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Get started with ATS in seconds
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full h-10 text-sm font-medium gap-2.5 mb-4"
              type="button"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs text-muted-foreground lg:bg-card">
                  or
                </span>
              </div>
            </div>

            <Form form={form} onSubmit={onSubmit} className="space-y-4">
                {form.formState.errors.root?.message && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <InputField
                          {...field}
                          label={t("email")}
                          type="email"
                          placeholder="acme@example.com"
                          className="h-10 text-sm"
                          autoComplete="email"
                          error={fieldState.error?.message}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <PasswordField
                          {...field}
                          label={t("password")}
                          placeholder="••••••••"
                          className="h-10 text-sm"
                          autoComplete="new-password"
                          error={fieldState.error?.message}
                        />
                      </FormControl>
                      {(password?.length ?? 0) > 0 && (
                        <div className="space-y-1 pt-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                          {PASSWORD_RULES.map((rule, i) => (
                            <div
                              key={rule.label}
                              className="flex items-center gap-2"
                            >
                              {ruleResults[i] ? (
                                <Icon
                                  name="Check"
                                  className="h-3 w-3 text-foreground"
                                />
                              ) : (
                                <Icon
                                  name="X"
                                  className="h-3 w-3 text-muted-foreground/50"
                                />
                              )}
                              <span
                                className={cn(
                                  "text-[11px] transition-colors",
                                  ruleResults[i]
                                    ? "text-foreground"
                                    : "text-muted-foreground/60"
                                )}
                              >
                                {rule.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <PasswordField
                          {...field}
                          label={t("confirm_password")}
                          placeholder="••••••••"
                          className="h-10 text-sm"
                          autoComplete="new-password"
                          error={fieldState.error?.message}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <Icon name="Loader" className="h-4 w-4 animate-spin" />
                  ) : (
                    t("create_account")
                  )}
                </Button>
            </Form>

            <p className="text-center text-xs text-muted-foreground mt-5">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-foreground font-medium hover:underline underline-offset-4"
              >
                {t("sign_in")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
