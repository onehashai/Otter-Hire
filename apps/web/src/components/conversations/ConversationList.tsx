"use client";

import { useState } from "react";
import { InputField } from "@onehash/ui/input";
import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import { Button } from "@onehash/ui/button";
import { Search, Plus, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface Conversation {
  id: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  unreadCount: number;
  stage: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCompose: () => void;
}

const filterOptions = ["All", "Unread", "Assigned to me", "Interview conversations"];

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCompose,
}: ConversationListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const filtered = conversations.filter((c) => {
    const matchesSearch =
      c.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      c.candidateEmail.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || (filter === "Unread" && c.unread);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b border-border">
        {/* <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{t("conversations_title")}</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCompose}>
            <Plus className="h-4 w-4" />
          </Button>
        </div> */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <InputField
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {filterOptions.map((f) => (
                <DropdownMenuItem
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn("text-xs", filter === f && "font-medium")}
                >
                  {f}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <p className="text-xs text-muted-foreground">No conversations found.</p>
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex items-start gap-2.5 px-3 py-3 cursor-pointer transition-colors border-b border-border/50",
                selectedId === c.id ? "bg-muted" : "hover:bg-muted/50"
              )}
            >
              <Avatar className="h-8 w-8 mt-0.5 shrink-0">
                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                  {c.candidateName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-xs truncate",
                      c.unread
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground"
                    )}
                  >
                    {c.candidateName}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {c.timestamp}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-[11px] truncate mt-0.5",
                    c.unread ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {c.lastMessage}
                </p>
              </div>
              {c.unread && (
                <div className="flex items-center mt-2">
                  <div className="h-2 w-2 rounded-full bg-foreground shrink-0" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
