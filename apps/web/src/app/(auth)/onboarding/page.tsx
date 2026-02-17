"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  InputField,
  Form,
  FormField,
  FormItem,
  FormControl,
  Icon,
} from "@onehash/ui";
import { onboardingSchema, type OnboardingFormValues } from "@/lib/schemas/zodResolver";
import { useTranslation } from "react-i18next";

export default function Onboarding() {
  const { t } = useTranslation();
  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: "",
      organization: "",
    },
  });

  const loading = form.formState.isSubmitting;

  const onSubmit = async (data: OnboardingFormValues) => {
    await new Promise((r) => setTimeout(r, 1200));
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[480px]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background text-sm font-bold">A</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">ATS</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight">Welcome to ATS</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tell us a little about yourself to get started
            </p>
          </div>

          <Form form={form} onSubmit={onSubmit} className="space-y-4">
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
                        error={fieldState.error?.message}
                        showAsterisk
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-medium"
                  disabled={loading}
                >
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
