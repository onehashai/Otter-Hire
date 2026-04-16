"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@onehash/ui/dialog";
import { FileText } from "lucide-react";
import { getTemplates } from "@/api/templates";

export interface AutomationTemplateConfig {
  name: string;
  triggerKey: string;
  triggerConfig: Record<string, unknown>;
  templateName: string;
}

const templates: {
  name: string;
  trigger: string;
  action: string;
  triggerKey: string;
  triggerConfig: Record<string, unknown>;
  templateName: string;
}[] = [
  {
    name: "Application Confirmation",
    trigger: "Candidate applied",
    action: "Send Application Received",
    triggerKey: "candidate_applied",
    triggerConfig: { label: "Candidate applied" },
    templateName: "Application Received",
  },
  // TODO: Re-enable interview automation starter when interview email templates are restored.
  // {
  //   name: "Interview Invitation",
  //   trigger: "Moved to Interview",
  //   action: "Send Interview Invitation",
  //   triggerKey: "candidate_moved",
  //   triggerConfig: { stage: "Interview", label: "Candidate moved to Interview" },
  //   templateName: "Interview Invitation",
  // },
  {
    name: "Rejection Email",
    trigger: "Moved to Rejected",
    action: "Send Candidate Rejection",
    triggerKey: "candidate_moved",
    triggerConfig: { stage: "Rejected", label: "Candidate moved to Rejected" },
    templateName: "Candidate Rejection",
  },
  {
    name: "Hiring Congratulations",
    trigger: "Moved to Hired",
    action: "Send Offer Letter",
    triggerKey: "candidate_moved",
    triggerConfig: { stage: "Hired", label: "Candidate moved to Hired" },
    templateName: "Send Offer Letter",
  },
  {
    name: "Job Assignment Email",
    trigger: "Job assigned",
    action: "Send Job Assignment Notification",
    triggerKey: "candidate_job_assigned",
    triggerConfig: { label: "Candidate job assigned" },
    templateName: "Job Assignment Notification",
  },
  {
    name: "Email Acknowledgment",
    trigger: "Email received",
    action: "Send Auto-Reply",
    triggerKey: "candidate_email_received",
    triggerConfig: { label: "Candidate email received" },
    templateName: "Email Auto-Reply",
  },
];

export interface AutomationTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate?: (config: AutomationTemplateConfig & { templateId?: string }) => void;
}

export function AutomationTemplatesDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: AutomationTemplatesDialogProps) {
  const [templatesById, setTemplatesById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getTemplates()
      .then((list) => {
        if (cancelled) return;
        const byName: Record<string, string> = {};
        for (const t of list) {
          byName[t.name] = t.id;
        }
        setTemplatesById(byName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSelectTemplate = (t: (typeof templates)[0]) => {
    onOpenChange(false);
    const templateId = templatesById[t.templateName];
    if (onSelectTemplate) {
      onSelectTemplate({
        name: t.name,
        triggerKey: t.triggerKey,
        triggerConfig: t.triggerConfig,
        templateName: t.templateName,
        ...(templateId && { templateId }),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Automation Templates</DialogTitle>
          <DialogDescription className="text-xs">
            Start from a pre-built template to save time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {templates.map((t) => (
            <Card
              key={t.name}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleSelectTemplate(t)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">
                        {t.trigger}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <Badge variant="outline" className="text-[10px]">
                        {t.action}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
