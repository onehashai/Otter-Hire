"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@onehash/ui/table";
import { jobPerformance } from "./data";

export function JobPerformanceSection() {
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
                <TableHead className="text-[11px] h-9 text-right hidden sm:table-cell">Conversion</TableHead>
                <TableHead className="text-[11px] h-9 text-right hidden sm:table-cell">Time to Hire</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobPerformance.map((job) => (
                <TableRow
                  key={job.id}
                >
                  <TableCell className="text-xs py-2.5 font-medium">{job.title}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right text-muted-foreground">{job.applicants}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right text-muted-foreground hidden sm:table-cell">{job.conversion}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right text-muted-foreground hidden sm:table-cell">{job.timeToHire}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right">
                    <Badge variant={job.status === "Active" ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                      {job.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
