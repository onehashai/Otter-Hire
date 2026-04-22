"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { ChevronRight } from "lucide-react";
import type { JobPerformanceItem } from "@/api/reports";

interface JobPerformanceSectionProps {
  data: JobPerformanceItem[];
}

export function JobPerformanceSection({ data }: JobPerformanceSectionProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Job Performance</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto -mx-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] h-9">Job Title</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Applicants</TableHead>
                <TableHead className="text-[11px] h-9 text-right hidden sm:table-cell">
                  Conversion
                </TableHead>
                <TableHead className="text-[11px] h-9 text-right hidden sm:table-cell">
                  Time to Hire
                </TableHead>
                <TableHead className="text-[11px] h-9 text-right">Status</TableHead>
                <TableHead className="w-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <TableCell className="text-xs py-2.5 font-medium">{job.title}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right text-muted-foreground">
                    {job.applicants}
                  </TableCell>
                  <TableCell className="text-xs py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                    {job.conversion_pct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-xs py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                    {job.avg_days_to_hire > 0 ? `${Math.round(job.avg_days_to_hire)}d` : "—"}
                  </TableCell>
                  <TableCell className="text-xs py-2.5 text-right">
                    <Badge
                      variant={job.status === "Active" ? "secondary" : "outline"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5 pl-0">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-xs text-muted-foreground text-center py-8">
                    No job data for this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
