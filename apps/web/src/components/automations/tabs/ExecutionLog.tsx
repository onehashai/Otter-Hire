"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { CheckCircle2, XCircle, User } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ExecutionLogEntry {
  id: string;
  candidateName: string;
  candidateEmail: string;
  event: string;
  action: string;
  timestamp: string;
  status: "success" | "failed";
  detail?: string;
}

export interface ExecutionLogProps {
  logs: ExecutionLogEntry[];
  onLogSelect: (log: ExecutionLogEntry) => void;
  isMobile: boolean;
}

export function ExecutionLog({ logs, onLogSelect, isMobile }: ExecutionLogProps) {
  const { t } = useTranslation();

  if (isMobile) {
    return (
      <div className="space-y-2">
        {logs.map((log) => (
          <Card
            key={log.id}
            className="cursor-pointer active:bg-muted/50 transition-colors"
            onClick={() => onLogSelect(log)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{log.candidateName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{log.candidateEmail}</p>
                  <p className="text-xs text-muted-foreground">{log.action}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{log.timestamp}</p>
                </div>
                {log.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t("candidate_name", "Candidate Name")}</TableHead>
              <TableHead className="text-xs">{t("candidate_email", "Candidate Email")}</TableHead>
              <TableHead className="text-xs">{t("event", "Event")}</TableHead>
              <TableHead className="text-xs">{t("time", "Time")}</TableHead>
              <TableHead className="text-xs">{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow
                key={log.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onLogSelect(log)}
              >
                <TableCell className="text-sm font-medium">{log.candidateName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {log.candidateEmail}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{log.event}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{log.timestamp}</TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
