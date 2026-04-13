"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { createTemplate } from "@/api/templates";
import { useToast } from "@/hooks/use-toast";

const createTemplateSchema = z.object({
  templateName: z.string().min(1, "Template name is required").max(200, "Name is too long"),
});

type CreateTemplateFormValues = z.infer<typeof createTemplateSchema>;

interface CreateTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTemplateModal({ open, onOpenChange }: CreateTemplateModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<CreateTemplateFormValues>({
    defaultValues: { templateName: "" },
    resolver: zodResolver(createTemplateSchema),
  });

  useEffect(() => {
    if (open) form.reset({ templateName: "" });
  }, [open, form]);

  const onSubmit = async (data: CreateTemplateFormValues) => {
    try {
      const template = await createTemplate({
        name: data.templateName.trim(),
        category: "Email",
        subject: "Subject",
        body: "",
      });
      onOpenChange(false);
      router.push(`/templates/${template.id}`);
    } catch {
      toast({ title: "Failed to create template", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create_template")}</DialogTitle>
          <DialogDescription>{t("create_template_description")}</DialogDescription>
        </DialogHeader>
        <Form form={form} onSubmit={onSubmit}>
          <FormField
            control={form.control}
            name="templateName"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <InputField
                    {...field}
                    label={t("template_name")}
                    autoFocus
                    placeholder="e.g. Interview Invitation"
                    className="mt-1.5"
                    error={fieldState.error?.message}
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
