"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { Skeleton, SkeletonCard, SkeletonBadge } from "@onehash/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

interface JobsListSkeletonProps {
  count?: number;
}

function JobCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-1.5">
          <Skeleton className="h-4 w-2/3" />
          <SkeletonBadge />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-1 w-1 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-1 w-1 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

function JobTableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-40" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-3 w-24" />
      </TableCell>
      <TableCell>
        <SkeletonBadge />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="h-3 w-8 ml-auto" />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="h-3 w-12 ml-auto" />
      </TableCell>
    </TableRow>
  );
}

export function JobsListSkeleton({ count = 5 }: JobsListSkeletonProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <JobCardSkeleton key={i} />
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
              <TableHead className="text-xs">
                <Skeleton className="h-3 w-12" />
              </TableHead>
              <TableHead className="text-xs">
                <Skeleton className="h-3 w-20" />
              </TableHead>
              <TableHead className="text-xs">
                <Skeleton className="h-3 w-14" />
              </TableHead>
              <TableHead className="text-xs text-right">
                <Skeleton className="h-3 w-20 ml-auto" />
              </TableHead>
              <TableHead className="text-xs text-right">
                <Skeleton className="h-3 w-24 ml-auto" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: count }).map((_, i) => (
              <JobTableRowSkeleton key={i} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
