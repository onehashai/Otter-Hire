"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Separator } from "@onehash/ui/separator";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface SummaryPanelProps {
  isActive: boolean;
  executionCount: number;
  createdBy: string;
  createdAt: string;
  lastModified: string;
  isMobile?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function SummaryPanel({
  isActive,
  executionCount,
  createdBy,
  createdAt,
  lastModified,
  isMobile,
  onEdit,
  onDelete,
}: SummaryPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("details", "Details")}
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("status")}
              </span>
              <Badge
                variant={isActive ? "default" : "secondary"}
                className="text-[10px] capitalize"
              >
                {isActive ? "Active" : "Paused"}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("executions", "Executions")}
              </span>
              <span className="text-sm font-medium">{executionCount}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("created_by", "Created by")}
              </span>
              <span className="text-xs">{createdBy}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("created", "Created")}
              </span>
              <span className="text-xs">{createdAt}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("last_modified", "Last modified")}
              </span>
              <span className="text-xs">{lastModified}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isMobile && onEdit && onDelete && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-9 text-xs gap-1.5"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" /> {t("edit", "Edit")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-9 text-xs gap-1.5 text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" /> {t("delete", "Delete")}
          </Button>
        </div>
      )}
    </div>
  );
}
