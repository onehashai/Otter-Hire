"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@onehash/ui/table";
import { recruiterData } from "./data";

export function RecruiterComparisonTable() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recruiter Comparison</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto -mx-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] h-9">Recruiter</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Candidates</TableHead>
                <TableHead className="text-[11px] h-9 text-right hidden sm:table-cell">Interviews</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Hires</TableHead>
                <TableHead className="text-[11px] h-9 text-right">Avg Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recruiterData.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="text-xs py-2.5 font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right text-muted-foreground">{r.handled}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right text-muted-foreground hidden sm:table-cell">{r.interviews}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right">{r.hires}</TableCell>
                  <TableCell className="text-xs py-2.5 text-right text-muted-foreground">{r.avgDays}d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
