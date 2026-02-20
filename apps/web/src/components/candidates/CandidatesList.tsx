"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import { Checkbox } from "@onehash/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Icon } from "@onehash/ui/icon";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  stage: string;
  rating: number;
  recruiter: string;
  lastActivity: string;
  appliedDate: string;
  tags: string[];
  source: string;
  phone: string;
  location: string;
}

const stageVariant = (stage: string) => {
  if (stage === "Hired") return "default";
  if (stage === "Rejected") return "destructive";
  return "secondary";
};

const RatingStars = ({ rating }: { rating: number }) => {
  const full = Math.floor(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i <= full ? "bg-foreground" : "bg-muted"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
};

interface CandidatesListProps {
  candidates: Candidate[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onBulkAction: (action: string) => void;
  onClearSelection: () => void;
}

export function CandidatesList({
  candidates,
  selected,
  onToggleSelect,
  onToggleAll,
  onBulkAction,
  onClearSelection,
}: CandidatesListProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  return (
    <>
      {/* Bulk Actions */}
      {selected.size > 0 && (
        <Card>
          <CardContent className="p-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">{t("selected_count", { count: selected.size })}</span>
            <div className="flex gap-1.5 ml-auto">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onBulkAction("Move stage")}>
                <Icon name="UserCheck" className="h-3 w-3 mr-1" /> Move Stage
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onBulkAction("Assign recruiter")}>
                {t("assign")}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => onBulkAction("Reject")}>
                <Icon name="X" className="h-3 w-3 mr-1" /> {t("reject")}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearSelection}>{t("clear")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {candidates.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Icon name="UserPlus" className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No candidates found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your filters or add your first candidate.
              </p>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5 mt-2">
              <Icon name="UserPlus" className="h-3.5 w-3.5" /> {t("add")}
            </Button>
          </CardContent>
        </Card>
      ) : isMobile ? (
        /* Mobile Cards */
        <div className="space-y-2">
          {candidates.map((c) => (
            <Card
              key={c.id}
              className="active:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/candidates/${c.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-2.5">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => onToggleSelect(c.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-muted">
                      {c.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <Icon name="ChevronLeft" className="h-4 w-4 text-muted-foreground shrink-0 rotate-180" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.role}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge variant={stageVariant(c.stage)} className="text-[10px]">
                        {c.stage}
                      </Badge>
                      <RatingStars rating={c.rating} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{c.recruiter}</span>
                      <span className="text-[10px] text-muted-foreground">{c.lastActivity}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop Table */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === candidates.length && candidates.length > 0}
                      onCheckedChange={onToggleAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs">Candidate</TableHead>
                  <TableHead className="text-xs">Applied For</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs">Rating</TableHead>
                  <TableHead className="text-xs">Recruiter</TableHead>
                  <TableHead className="text-xs text-right">Activity</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/candidates/${c.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => onToggleSelect(c.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] bg-muted">
                            {c.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="text-sm font-medium">{c.name}</span>
                          <p className="text-[11px] text-muted-foreground">{c.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.role}</TableCell>
                    <TableCell>
                      <Badge variant={stageVariant(c.stage)} className="text-[10px]">
                        {c.stage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RatingStars rating={c.rating} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.recruiter}</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">{c.lastActivity}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Icon name="MoreHorizontal" className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem className="text-xs" onClick={() => toast({ title: "Stage updated" })}>
                            <Icon name="UserCheck" className="h-3.5 w-3.5 mr-2" /> Move Stage
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs" onClick={() => toast({ title: "Interview scheduled" })}>
                            <Icon name="Clock" className="h-3.5 w-3.5 mr-2" /> Schedule Interview
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-xs text-destructive focus:text-destructive"
                            onClick={() => toast({ title: "Candidate rejected", variant: "destructive" })}
                          >
                            <Icon name="X" className="h-3.5 w-3.5 mr-2" /> Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
