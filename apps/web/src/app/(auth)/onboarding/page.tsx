"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Form, FormField, FormItem, FormControl } from "@onehash/ui/form";
import { Icon } from "@onehash/ui/icon";
import { onboardingSchema, type OnboardingFormValues } from "@/lib/schemas/zodResolver";
import { useTranslation } from "react-i18next";
import { LOGO_SVG_PATH, PLATFORM_NAME } from "@/lib/constants";
import { completeOnboarding } from "@/api/index";
import { useAuthSession } from "@/app/providers";

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshSession } = useAuthSession();
  const inviteDeclined = searchParams.get("invite_declined") === "1";
  const isInviteOnboarding = user?.status === "pending";
  const shouldLockOrgName = isInviteOnboarding && !inviteDeclined;
  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: "",
      organization: "",
    },
  });

  const loading = form.formState.isSubmitting;

  useEffect(() => {
    if (isInviteOnboarding && user?.org_name) {
      form.setValue("organization", user.org_name, { shouldValidate: true });
    }
  }, [form, isInviteOnboarding, user?.org_name]);

  const onSubmit = async (data: OnboardingFormValues) => {
    form.clearErrors("root");
    try {
      await completeOnboarding({
        full_name: data.fullName,
        organization_name: data.organization,
      });
      await refreshSession();
      localStorage.setItem("session_updated", Date.now().toString());
      // TODO(mvp-nav): Restore dashboard/home redirect after MVP launch.
      // router.replace("/");
      router.replace("/");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Onboarding failed";
      form.setError("root", { message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[480px]">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <Image
            src={LOGO_SVG_PATH}
            alt="Otter Hire"
            width={140}
            height={42}
            className="object-contain block dark:invert dark:contrast-200"
            priority
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight">Welcome to {PLATFORM_NAME}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tell us a little about yourself to get started
            </p>
          </div>

          <Form form={form} onSubmit={onSubmit} className="space-y-4">
            {form.formState.errors.root?.message && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <InputField
                      {...field}
                      label={t("full_name")}
                      placeholder="Jane Doe"
                      className="h-10 text-sm"
                      autoComplete="name"
                      error={fieldState.error?.message}
                      showAsterisk
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organization"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <InputField
                      {...field}
                      label={t("organization_name")}
                      placeholder="Acme Inc"
                      className="h-10 text-sm"
                      autoComplete="organization"
                      disabled={shouldLockOrgName}
                      error={fieldState.error?.message}
                      showAsterisk
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="pt-2">
              <Button type="submit" className="w-full h-10 text-sm font-medium" disabled={loading}>
                {loading ? (
                  <Icon name="Loader" className="h-4 w-4 animate-spin" />
                ) : (
                  t("continue_to_dashboard")
                )}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
