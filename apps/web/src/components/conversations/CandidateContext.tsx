"use client";

import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import { Badge } from "@onehash/ui/badge";
import { Button } from "@onehash/ui/button";
import { Separator } from "@onehash/ui/separator";
import { Mail, Phone, MapPin, ArrowRight, StickyNote, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import type { ConversationStatus } from "@/api/conversations";

interface CandidateContextProps {
  name: string;
  email: string;
  phone: string;
  location: string;
  jobTitle: string;
  stage: string;
  recruiter: string;
  dateApplied: string;
  activities: { label: string; date: string }[];
  conversationStatus: ConversationStatus;
  onConversationStatusChange: (status: ConversationStatus) => void;
  onMoveStage: () => void;
  onAddNote: () => void;
  onScheduleInterview: () => void;
}

export function CandidateContext({
  name,
  email,
  phone,
  location,
  jobTitle,
  stage,
  recruiter,
  dateApplied,
  activities,
  conversationStatus,
  onConversationStatusChange,
  onMoveStage,
  onAddNote,
  onScheduleInterview,
}: CandidateContextProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-medium text-foreground">{name}</h3>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{email}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{phone}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{location}</span>
          </div>
        </div>
      </div>

      <Separator />

      <div className="p-4 space-y-2">
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Pipeline Status
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Stage</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {stage}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Recruiter</span>
            <span className="text-foreground font-medium">{recruiter}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Applied</span>
            <span className="text-foreground">{dateApplied}</span>
          </div>
        </div>
      </div>

      <Separator />

      <div className="p-4 space-y-2">
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Conversation Status
        </h4>
        <Select value={conversationStatus} onValueChange={onConversationStatusChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open" className="text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                Open
              </div>
            </SelectItem>
            <SelectItem value="closed" className="text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gray-400" />
                Closed
              </div>
            </SelectItem>
            <SelectItem value="archived" className="text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                Archived
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="p-4 space-y-1.5">
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Quick Actions
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs h-8 gap-2"
          onClick={onMoveStage}
        >
          <ArrowRight className="h-3 w-3" /> Move Stage
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs h-8 gap-2"
          onClick={onAddNote}
        >
          <StickyNote className="h-3 w-3" /> Add Note
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs h-8 gap-2"
          onClick={onScheduleInterview}
        >
          <Calendar className="h-3 w-3" /> Schedule Interview
        </Button>
      </div>

      <Separator />

      <div className="p-4 space-y-2">
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Activity
        </h4>
        <div className="space-y-2">
          {activities.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
              <div>
                <p className="text-[11px] text-foreground">{a.label}</p>
                <p className="text-[10px] text-muted-foreground">{a.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
