"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@onehash/ui/dialog";
import { Badge } from "@onehash/ui/badge";
import { Separator } from "@onehash/ui/separator";
import { useTranslation } from "react-i18next";
import type { ExecutionLogEntry } from "./ExecutionLog";

export interface ExecutionDetailsDialogProps {
  log: ExecutionLogEntry | null;
  onOpenChange: (open: boolean) => void;
}

export function ExecutionDetailsDialog({ log, onOpenChange }: ExecutionDetailsDialogProps) {
  const { t } = useTranslation();
  const open = !!log;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {t("execution_details", "Execution Details")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("execution_details_description", "Log entry for this execution.")}
          </DialogDescription>
        </DialogHeader>
        {log && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("candidate", "Candidate")}</span>
              <span className="text-sm font-medium">{log.candidateName}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("event", "Event")}</span>
              <span className="text-xs">{log.event}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("action", "Action")}</span>
              <span className="text-xs">{log.action}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("time", "Time")}</span>
              <span className="text-xs">{log.timestamp}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("status")}</span>
              {log.status === "success" ? (
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                  Success
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] text-destructive border-destructive/30"
                >
                  Failed
                </Badge>
              )}
            </div>
            {log.detail && (
              <>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground">{t("detail", "Detail")}</span>
                  <p className="text-xs mt-1">{log.detail}</p>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
