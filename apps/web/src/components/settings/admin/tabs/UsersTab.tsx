"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@onehash/ui/badge";
import { Button } from "@onehash/ui/button";
import { Card, CardContent } from "@onehash/ui/card";
import { Avatar } from "@onehash/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { Skeleton } from "@onehash/ui/skeleton";
import { Icon } from "@onehash/ui/icon";
import { cn } from "@/lib/utils";
import { getInitialsFromName } from "@/lib/name-initials";
import { formatRole } from "@/components/settings/team/lib/permissonMatrix";
import type { BackendRole } from "@/components/settings/team/lib/permissonMatrix";
import { getAdminUserMemberships, type AdminUserMembershipRow } from "@/api/admin";
import { AdminUserEditDialog } from "@/components/settings/admin/dialogs/AdminUserEditDialog";

const orgRoleBadgeClass: Record<BackendRole, string> = {
  owner: "bg-foreground text-background",
  admin: "bg-foreground/80 text-background",
  recruiter: "bg-muted text-foreground",
  hiring_manager: "bg-muted text-foreground",
  interviewer: "bg-muted text-muted-foreground",
  employee: "bg-muted text-muted-foreground",
};

function orgRoleBadgeClassFor(role: string): string {
  if (role in orgRoleBadgeClass) return orgRoleBadgeClass[role as BackendRole];
  return "bg-muted text-foreground";
}

function productRoleBadgeClass(role: string): string {
  if (role === "admin") return "bg-foreground text-background";
  return "bg-muted text-foreground";
}

function formatProductRole(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "user") return "User";
  return role;
}

function formatMembershipStatus(status: string): { label: string } {
  if (status === "active") return { label: "Active" };
  if (status === "invited") return { label: "Invited" };
  if (status === "disabled") return { label: "Disabled" };
  return { label: status };
}

function formatLastActive(iso: string | null | undefined, status: string): string {
  if (status === "invited") return "—";
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function UsersAdminTab() {
  const [rows, setRows] = useState<AdminUserMembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editRow, setEditRow] = useState<AdminUserMembershipRow | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getAdminUserMemberships();
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load users";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = (updated: AdminUserMembershipRow) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.membership_id === updated.membership_id) return updated;
        if (r.user_id === updated.user_id) {
          return {
            ...r,
            name: updated.name,
            email: updated.email,
            avatar_url: updated.avatar_url,
            product_role: updated.product_role,
            last_active_at: updated.last_active_at,
          };
        }
        return r;
      }),
    );
  };

  return (
    <div className="space-y-4">
      <AdminUserEditDialog
        row={editRow}
        onOpenChange={(open) => !open && setEditRow(null)}
        onSaved={handleSaved}
      />
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
              <Icon name="Users" className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No team memberships found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium h-10">Name</TableHead>
                  <TableHead className="text-xs font-medium h-10">Organization name</TableHead>
                  <TableHead className="text-xs font-medium h-10">Platform role</TableHead>
                  <TableHead className="text-xs font-medium h-10">Organization Role</TableHead>
                  <TableHead className="text-xs font-medium h-10">Status</TableHead>
                  <TableHead className="text-xs font-medium h-10">Last active</TableHead>
                  <TableHead className="text-xs font-medium h-10 w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const st = formatMembershipStatus(row.status);
                  return (
                    <TableRow key={row.membership_id}>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            className="h-8 w-8 shrink-0"
                            src={row.avatar_url}
                            alt={row.name || row.email}
                            fallbackClassName="text-xs bg-muted"
                          >
                            {getInitialsFromName(row.name)}
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{row.name || row.email}</p>
                            <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm text-foreground truncate block max-w-[200px]">
                          {row.org_name}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-2 py-0 h-5 font-medium border-0",
                            productRoleBadgeClass(row.product_role),
                          )}
                        >
                          {formatProductRole(row.product_role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-2 py-0 h-5 font-medium border-0 truncate max-w-full min-w-0",
                            orgRoleBadgeClassFor(row.organization_role),
                          )}
                          title={formatRole(row.organization_role)}
                        >
                          {formatRole(row.organization_role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-xs text-muted-foreground">{st.label}</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-xs text-muted-foreground">
                          {formatLastActive(row.last_active_at, row.status)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Icon name="MoreHorizontal" className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setEditRow(row)}>
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
