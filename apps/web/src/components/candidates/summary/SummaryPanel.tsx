"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import { Separator } from "@onehash/ui/separator";
import { Icon } from "@onehash/ui/icon";

interface Document {
  name: string;
  type: string;
  date: string;
  size: string;
}

interface CandidateSummary {
  name: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  stage: string;
  rating: number;
  source: string;
  appliedDate: string;
  documents: Document[];
  linkedin?: string;
  portfolio?: string;
  coverLetter?: boolean;
  tags: string[];
}

interface SummaryPanelProps {
  candidate: CandidateSummary;
}

const stageVariant = (stage: string) => {
  if (stage === "Hired") return "default" as const;
  if (stage === "Rejected") return "destructive" as const;
  return "secondary" as const;
};

export function SummaryPanel({ candidate }: SummaryPanelProps) {
  const initials = candidate.name.split(" ").map((n) => n[0]).join("");

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-muted text-sm font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-base font-semibold">{candidate.name}</h2>
              <p className="text-xs text-muted-foreground">{candidate.role}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="Mail" className="h-3.5 w-3.5" /> {candidate.email}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="Mic" className="h-3.5 w-3.5" /> {candidate.phone}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="MapPin" className="h-3.5 w-3.5" /> {candidate.location}
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stage</p>
              <Badge variant={stageVariant(candidate.stage)} className="text-[10px] mt-1">
                {candidate.stage}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rating</p>
              <div className="flex items-center gap-1 mt-1">
                <Icon name="Crown" className="h-3 w-3 text-foreground" />
                <span className="text-sm font-medium">{candidate.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source</p>
            <Badge variant="outline" className="text-[10px]">
              {candidate.source}
            </Badge>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Applied</p>
            <span className="text-xs">{candidate.appliedDate}</span>
          </div>
        </CardContent>
      </Card>

      {/* Resume & Links */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Resume & Links
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {candidate.documents.filter((d) => d.type === "Resume").length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs w-full justify-start gap-2">
              <Icon name="ScrollText" className="h-3.5 w-3.5" />
              <span className="truncate flex-1 text-left">{candidate.documents[0].name}</span>
            </Button>
          )}
          {candidate.coverLetter && (
            <Button variant="ghost" size="sm" className="h-8 text-xs w-full justify-start gap-2">
              <Icon name="ScrollText" className="h-3.5 w-3.5" /> Cover Letter
            </Button>
          )}
          {candidate.linkedin && (
            <Button variant="ghost" size="sm" className="h-8 text-xs w-full justify-start gap-2">
              <Icon name="Link" className="h-3.5 w-3.5" /> LinkedIn
            </Button>
          )}
          {candidate.portfolio && (
            <Button variant="ghost" size="sm" className="h-8 text-xs w-full justify-start gap-2">
              <Icon name="Link" className="h-3.5 w-3.5" /> Portfolio
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
