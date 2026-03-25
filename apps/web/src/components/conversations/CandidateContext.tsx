"use client";

import { Avatar } from "@onehash/ui/avatar";
import { Separator } from "@onehash/ui/separator";
import { Mail, Phone, MapPin } from "lucide-react";
import { getInitialsFromName } from "@/lib/name-initials";

interface CandidateContextProps {
  name: string;
  email: string;
  phone: string;
  location: string;
  activities: { label: string; date: string }[];
}

export function CandidateContext({
  name,
  email,
  phone,
  location,
  activities,
}: CandidateContextProps) {
  const initials = getInitialsFromName(name);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-10 w-10" fallbackClassName="text-xs bg-muted text-muted-foreground">
            {initials}
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
