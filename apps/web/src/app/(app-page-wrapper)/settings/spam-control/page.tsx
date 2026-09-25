"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@onehash/ui/button";
import { Card, CardContent } from "@onehash/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { Icon } from "@onehash/ui/icon";
import { InputField } from "@onehash/ui/input";
import { toast } from "@onehash/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { useAuthSession } from "@/app/providers";
import {
  createBlockedDomains,
  deleteBlockedDomain,
  getBlockedDomains,
  type BlockedDomainResponse,
} from "@/api";

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function normalizeDomainInput(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, "").replace(/^\*\./, "").replace(/\.$/, "");
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function SpamControlPage() {
  const { user } = useAuthSession();
  const canManage = ["owner", "admin"].includes(user?.membership_role ?? "");
  const [domains, setDomains] = useState<BlockedDomainResponse[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<BlockedDomainResponse | null>(null);

  const loadDomains = async () => {
    try {
      setDomains(await getBlockedDomains());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load blocked domains");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDomains();
  }, []);

  const filteredDomains = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? domains.filter((entry) => entry.domain.includes(term)) : domains;
  }, [domains, search]);

  const handleAdd = async () => {
    const domain = normalizeDomainInput(domainInput);
    if (!DOMAIN_PATTERN.test(domain)) {
      toast.error("Enter a valid email domain, such as naukri.com");
      return;
    }

    setSubmitting(true);
    try {
      await createBlockedDomains([domain]);
      setDomainInput("");
      await loadDomains();
      toast.success(`${domain} is now blocked`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to block domain");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!domainToDelete) return;
    setSubmitting(true);
    try {
      await deleteBlockedDomain(domainToDelete.id);
      setDomains((current) => current.filter((entry) => entry.id !== domainToDelete.id));
      setDomainToDelete(null);
      toast.success(`${domainToDelete.domain} is no longer blocked`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unblock domain");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-1">Spam Control</h2>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Block specific email domains from automatically creating candidates or triggering parse
            workflows in your ATS (e.g. naukri.com, jobseeker-mail.com). Inbound emails matching
            these domains will be safely ignored without polluting your talent pool.
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="blocked-domain" className="text-sm font-medium">
                  Email domain
                </label>
                <InputField
                  id="blocked-domain"
                  value={domainInput}
                  onChange={(event) => setDomainInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleAdd();
                    }
                  }}
                  placeholder="e.g. naukri.com"
                  disabled={!canManage || submitting}
                />
              </div>
              <Button
                className="gap-1.5 shrink-0"
                onClick={() => void handleAdd()}
                disabled={!canManage || submitting}
              >
                <Icon name="Plus" className="h-4 w-4" />
                {submitting ? "Blocking..." : "Block domain"}
              </Button>
            </div>
            {!canManage ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Only organization owners and admins can manage blocked domains.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-medium">Blocked domains</h3>
            <InputField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search domains"
              className="sm:w-64"
              aria-label="Search blocked domains"
            />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 text-xs font-medium">Domain name</TableHead>
                    <TableHead className="h-10 text-xs font-medium">Added date</TableHead>
                    <TableHead className="h-10 text-right text-xs font-medium">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        Loading blocked domains...
                      </TableCell>
                    </TableRow>
                  ) : filteredDomains.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        {search ? "No blocked domains match your search." : "No domains are blocked."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDomains.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="py-3 text-sm">{entry.domain}</TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setDomainToDelete(entry)}
                            disabled={!canManage}
                            aria-label={`Unblock ${entry.domain}`}
                          >
                            <Icon name="Trash2" className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={domainToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setDomainToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unblock domain</DialogTitle>
            <DialogDescription>
              Remove {domainToDelete?.domain} from the blocked list? Future emails from this domain
              can create candidates and enter parsing workflows again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainToDelete(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={submitting}>
              {submitting ? "Unblocking..." : "Unblock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
