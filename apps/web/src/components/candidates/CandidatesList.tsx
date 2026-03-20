"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Icon } from "@onehash/ui/icon";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  stage: string;
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

interface CandidatesListProps {
  candidates: Candidate[];
}

export function CandidatesList({ candidates }: CandidatesListProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();

  return (
    <>
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
      ) : (
        <div className="space-y-2">
          {candidates.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:shadow-sm active:bg-muted/50 transition-all"
              onClick={() => router.push(`/candidates/${c.id}`)}
            >
              <CardContent className="p-4 py-3">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-muted">
                      {c.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5 min-w-0">
                      <h3 className="text-sm font-medium truncate min-w-0 max-w-[10rem] sm:max-w-[14rem]">
                        {c.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Badge variant={stageVariant(c.stage)} className="text-[10px]">
                          {c.stage}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] max-w-[12rem] font-normal"
                          title={c.role}
                        >
                          <span className="block truncate">{c.role}</span>
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                  </div>
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Icon name="MoreHorizontal" className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => toast({ title: "Stage updated" })}
                        >
                          <Icon name="UserCheck" className="h-3.5 w-3.5 mr-2" /> Move Stage
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => toast({ title: "Interview scheduled" })}
                        >
                          <Icon name="Clock" className="h-3.5 w-3.5 mr-2" /> Schedule Interview
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-xs text-destructive focus:text-destructive"
                          onClick={() =>
                            toast({ title: "Candidate rejected", variant: "destructive" })
                          }
                        >
                          <Icon name="X" className="h-3.5 w-3.5 mr-2" /> Reject
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
