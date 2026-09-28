"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@onehash/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import { useAuthSession } from "@/app/providers";
import {
  createBlockedDomains,
  createBlockedEmailAddresses,
  deleteBlockedDomain,
  deleteBlockedEmailAddress,
  getBlockedDomains,
  getBlockedEmailAddresses,
  type BlockedDomainResponse,
  type BlockedEmailAddressResponse,
} from "@/api";
import { isValidEmail, normalizeEmail } from "@/lib/validation/contact";

type BlockType = "domain" | "email";
type BlockedEntry = { id: string; value: string; created_at: string };

function domainEntries(rows: BlockedDomainResponse[]): BlockedEntry[] {
  return rows.map((row) => ({ ...row, value: row.domain }));
}

function emailEntries(rows: BlockedEmailAddressResponse[]): BlockedEntry[] {
  return rows.map((row) => ({ ...row, value: row.email }));
}

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
  const orgId = user?.org_id;
  const canManage = ["owner", "admin"].includes(user?.membership_role ?? "");
  const [blockType, setBlockType] = useState<BlockType>("domain");
  const [domains, setDomains] = useState<BlockedEntry[]>([]);
  const [emails, setEmails] = useState<BlockedEntry[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<BlockedEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const isEmail = blockType === "email";
  const label = isEmail ? "email address" : "domain";
  const entries = isEmail ? emails : domains;
  const setEntries = isEmail ? setEmails : setDomains;

  useEffect(() => {
    if (!orgId) return;
    let active = true;
    setDomains([]);
    setEmails([]);
    setLoadError(null);
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.all([getBlockedDomains(), getBlockedEmailAddresses()])
      .then(([domainRows, emailRows]) => {
        if (active) {
          setDomains(domainEntries(domainRows));
          setEmails(emailEntries(emailRows));
        }
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(error instanceof Error ? error.message : "Failed to load blocked senders");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgId, canManage, reloadKey]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? entries.filter((entry) => entry.value.includes(term)) : entries;
  }, [entries, search]);

  const handleAdd = async () => {
    if (!canManage || submitting || loading || loadError) return;
    const value = isEmail ? normalizeEmail(input) : normalizeDomainInput(input);
    if (isEmail ? !isValidEmail(value) : !DOMAIN_PATTERN.test(value)) {
      toast.error(
        isEmail
          ? "Enter a valid email address, such as sender@example.com"
          : "Enter a valid email domain, such as naukri.com",
      );
      return;
    }

    setSubmitting(true);
    try {
      const added = isEmail
        ? emailEntries(await createBlockedEmailAddresses([value]))
        : domainEntries(await createBlockedDomains([value]));
      const addedIds = new Set(added.map((entry) => entry.id));
      setEntries((current) =>
        [...added, ...current.filter((entry) => !addedIds.has(entry.id))].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
      );
      setInput("");
      toast.success(`${value} is now blocked`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to block ${label}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!entryToDelete || !canManage || submitting) return;
    setSubmitting(true);
    try {
      if (isEmail) await deleteBlockedEmailAddress(entryToDelete.id);
      else await deleteBlockedDomain(entryToDelete.id);
      setEntries((current) => current.filter((entry) => entry.id !== entryToDelete.id));
      setEntryToDelete(null);
      toast.success(`${entryToDelete.value} is no longer blocked`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to unblock ${label}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-1">Spam Control</h2>
        </div>
        <Tabs
          value={blockType}
          onValueChange={(value) => {
            setBlockType(value as BlockType);
            setInput("");
            setSearch("");
            setEntryToDelete(null);
          }}
        >
          <TabsList aria-label="Block list type">
            <TabsTrigger value="domain" disabled={submitting}>
              Domains
            </TabsTrigger>
            <TabsTrigger value="email" disabled={submitting}>
              Email addresses
            </TabsTrigger>
          </TabsList>
          <TabsContent value={blockType} className="space-y-6 pt-4">
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor="blocked-sender" className="text-sm font-medium">
                    {isEmail ? "Email address" : "Email domain"}
                  </label>
                  <InputField
                    id="blocked-sender"
                    type={isEmail ? "email" : "text"}
                    autoCapitalize="none"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleAdd();
                      }
                    }}
                    placeholder={isEmail ? "e.g. sender@gmail.com" : "e.g. naukri.com"}
                    disabled={!canManage || submitting || loading || !!loadError}
                  />
                </div>
                <Button
                  className="gap-1.5 shrink-0"
                  onClick={() => void handleAdd()}
                  disabled={!canManage || submitting || loading || !!loadError}
                >
                  <Icon name="Plus" className="h-4 w-4" />
                  {submitting ? "Saving..." : isEmail ? "Block email" : "Block domain"}
                </Button>
              </div>
              {!canManage ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Only organization owners and admins can manage blocked senders.
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-medium shrink-0">
                  {isEmail ? "Blocked email addresses" : "Blocked domains"}
                </h3>
                <div className="w-full sm:w-64">
                  <InputField
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={isEmail ? "Search email addresses" : "Search domains"}
                    aria-label={isEmail ? "Search blocked email addresses" : "Search blocked domains"}
                  />
                </div>
              </div>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-10 text-xs font-medium">
                        {isEmail ? "Email address" : "Domain name"}
                      </TableHead>
                      <TableHead className="h-10 text-xs font-medium">Added date</TableHead>
                      <TableHead className="h-10 text-right text-xs font-medium">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          Loading blocked senders...
                        </TableCell>
                      </TableRow>
                    ) : loadError ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-sm text-destructive"
                        >
                          <p>{loadError}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 gap-1.5"
                            onClick={() => setReloadKey((value) => value + 1)}
                          >
                            <Icon name="RefreshCw" className="h-4 w-4" />
                            Retry
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          {search
                            ? "No blocked senders match your search."
                            : isEmail
                              ? "No email addresses are blocked."
                              : "No domains are blocked."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="py-3 text-sm break-all">{entry.value}</TableCell>
                          <TableCell className="py-3 text-sm text-muted-foreground">
                            {formatDate(entry.created_at)}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setEntryToDelete(entry)}
                                  disabled={!canManage || submitting}
                                  aria-label={`Unblock ${entry.value}`}
                                >
                                  <Icon
                                    name="Trash2"
                                    className="h-4 w-4 text-muted-foreground hover:text-destructive"
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Unblock {label}</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={entryToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setEntryToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unblock {label}</DialogTitle>
            <DialogDescription>
              Remove {entryToDelete?.value} from the blocked list?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryToDelete(null)} disabled={submitting}>
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
