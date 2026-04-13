"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@onehash/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { Skeleton } from "@onehash/ui/skeleton";
import { Icon } from "@onehash/ui/icon";
import { getAdminOrganizations, type AdminOrganizationRow } from "@/api/admin";

function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OrganizationsAdminTab() {
  const [rows, setRows] = useState<AdminOrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getAdminOrganizations();
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load organizations";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Organizations</h2>
        <p className="text-xs text-muted-foreground">
          View organizations and membership size across the platform.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Icon name="Building2" className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No organizations found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium h-10">Organization name</TableHead>
                  <TableHead className="text-xs font-medium h-10 text-right">Members</TableHead>
                  <TableHead className="text-xs font-medium h-10">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                        {row.website ? (
                          <p className="text-xs text-muted-foreground truncate">{row.website}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {row.member_count}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-xs text-muted-foreground">
                        {formatCreated(row.created_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
