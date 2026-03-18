"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@onehash/ui/dialog";

const SAMPLE_DATA: Record<string, string> = {
  "{{candidate_name}}": "Alex Johnson",
  "{{candidate_email}}": "alex@example.com",
  "{{job_title}}": "Senior Frontend Engineer",
  "{{job_location}}": "San Francisco, CA",
  "{{interview_date}}": "March 15, 2026 at 2:00 PM",
  "{{interviewer_name}}": "Sarah Chen",
  "{{company_name}}": "Acme Inc",
};

function replaceVars(text: string) {
  let result = text;
  Object.entries(SAMPLE_DATA).forEach(([k, v]) => {
    result = result.split(k).join(v);
  });
  return result;
}

interface TemplatePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  body: string;
}

export function TemplatePreviewModal({
  open,
  onOpenChange,
  subject,
  body,
}: TemplatePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Template Preview</DialogTitle>
          <DialogDescription>Variables replaced with sample data.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
            <p className="text-sm text-foreground">{replaceVars(subject)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
            <div
              className="prose prose-sm max-w-none text-foreground text-sm border border-border rounded-md p-4"
              dangerouslySetInnerHTML={{ __html: replaceVars(body) }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
