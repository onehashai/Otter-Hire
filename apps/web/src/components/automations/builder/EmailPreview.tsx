"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Separator } from "@onehash/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@onehash/ui/dialog";

export interface EmailPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailPreview({ open, onOpenChange }: EmailPreviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Email Preview</DialogTitle>
          <DialogDescription className="text-xs">
            Preview how the email will look.
          </DialogDescription>
        </DialogHeader>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="text-sm font-medium">
                Update on your application
              </p>
            </div>
            <Separator />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Dear {"{{candidate_name}}"},</p>
              <p>
                Thank you for your interest in the {"{{job_title}}"}{" "}
                position at our company.
              </p>
              <p>
                After careful consideration, we have decided to move forward with
                other candidates whose qualifications more closely match our
                current needs.
              </p>
              <p>
                We appreciate the time you invested in the application process
                and wish you success in your career search.
              </p>
              <p className="mt-4">
                Best regards,
                <br />
                {"{{company_name}}"} Hiring Team
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
