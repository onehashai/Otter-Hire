"use client";

import { useRouter } from "next/navigation";
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

const templates = [
  { name: "Auto-reject unqualified", trigger: "Candidate applied", action: "Send rejection email" },
  { name: "Schedule screening", trigger: "Moved to Screening", action: "Send calendar link" },
  { name: "Stale application alert", trigger: "5 days in stage", action: "Notify recruiter" },
  { name: "Welcome new hire", trigger: "Candidate hired", action: "Send welcome email" },
  { name: "Close job automatically", trigger: "All positions filled", action: "Close job" },
  { name: "Tag senior candidates", trigger: "Experience > 5 years", action: "Add 'Senior' tag" },
];

export interface AutomationTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutomationTemplatesDialog({
  open,
  onOpenChange,
}: AutomationTemplatesDialogProps) {
  const router = useRouter();

  const handleSelectTemplate = () => {
    onOpenChange(false);
    router.push("/automations/new");
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
              onClick={handleSelectTemplate}
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
