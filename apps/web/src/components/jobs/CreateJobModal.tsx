"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@onehash/ui/dialog";
import { Form, FormField, FormItem, FormControl } from "@onehash/ui/form";
import { useRouter } from "next/navigation";
import { jobNameSchema, type JobNameFormValues } from "@/lib/schemas/zodResolver";
import { createJob } from "@/api";
import { toast } from "sonner";

interface CreateJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateJobModal({ open, onOpenChange }: CreateJobModalProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const form = useForm<JobNameFormValues>({
    defaultValues: { jobName: "" },
    resolver: zodResolver(jobNameSchema),
  });

  useEffect(() => {
    if (open) form.reset({ jobName: "" });
  }, [open, form]);

  const onSubmit = async (data: JobNameFormValues) => {
    try {
      const job = await createJob(data.jobName.trim());
      onOpenChange(false);
      router.push(`/jobs/${job.id}/info`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create job");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create_job")}</DialogTitle>
          <DialogDescription>{t("create_job_description")}</DialogDescription>
        </DialogHeader>
        <Form form={form} onSubmit={onSubmit}>
          <FormField
            control={form.control}
            name="jobName"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <InputField
                    {...field}
                    label={t("job_name")}
                    autoFocus
                    placeholder="e.g. Senior Frontend Engineer"
                    className="mt-1.5"
                    error={
                      fieldState.error?.message
                        ? fieldState.error.message === "min"
                          ? t("min_char_length", { count: 1 })
                          : fieldState.error.message === "max"
                            ? t("max_char_length", { count: 100 })
                            : t("job_name_invalid")
                        : undefined
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        form.handleSubmit(onSubmit)();
                      }
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" type="button" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button size="sm" type="submit" disabled={form.formState.isSubmitting}>
              {t("create")}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
