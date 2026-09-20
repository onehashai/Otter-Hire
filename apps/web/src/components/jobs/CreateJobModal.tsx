"use client";

import { useEffect, useState } from "react";
import { Switch } from "@onehash/ui/switch";
import { getLinkedInStatus } from "@/api/linkedin";
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
import Link from "next/link";
import { jobNameSchema, type JobNameFormValues } from "@/lib/schemas/zodResolver";
import { createJob } from "@/api";
import { toast } from "@onehash/ui/sonner";

interface CreateJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateJobModal({ open, onOpenChange }: CreateJobModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [canPost, setCanPost] = useState(false);
  const [postToLinkedin, setPostToLinkedin] = useState(false);

  const form = useForm<JobNameFormValues>({
    defaultValues: { jobName: "" },
    resolver: zodResolver(jobNameSchema),
  });

  useEffect(() => {
    let active = true;
    if (open) {
      form.reset({ jobName: "" });
      setPostToLinkedin(false);
      setCanPost(false);
      void getLinkedInStatus()
        .then((status) => {
          if (active) setCanPost(Boolean(status.can_post));
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [open, form]);

  const onSubmit = async (data: JobNameFormValues) => {
    try {
      const job = await createJob(data.jobName.trim(), postToLinkedin);
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
          <label className="flex items-center justify-between gap-3 py-3 text-sm">
            Post to LinkedIn
            <Switch
              aria-label="Post to LinkedIn"
              checked={postToLinkedin}
              onCheckedChange={setPostToLinkedin}
              disabled={!canPost}
            />
          </label>
          {!canPost && (
            <Link className="text-xs underline" href="/settings/integrations">
              LinkedIn connection required
            </Link>
          )}
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
