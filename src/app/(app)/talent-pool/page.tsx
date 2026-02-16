"use client";

import { useState } from "react";
import { Card, CardContent, Badge, Avatar, AvatarFallback } from "@onehash/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { MainPagesLayout } from "@/components/MainPagesLayout";

const poolCandidates = [
  { name: "Chris Evans", tags: ["React", "Node.js"], source: "Referral", lastContact: "2w ago", engagement: "High" },
  { name: "Priya Patel", tags: ["Python", "ML"], source: "LinkedIn", lastContact: "1m ago", engagement: "Medium" },
  { name: "Tom Hardy", tags: ["Design", "Figma"], source: "Event", lastContact: "3w ago", engagement: "Low" },
  { name: "Ana Silva", tags: ["Go", "K8s"], source: "Direct", lastContact: "5d ago", engagement: "High" },
];

const initials = (name: string) => name.split(" ").map(n => n[0]).join("");

export default function TalentPoolPage() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const filtered = poolCandidates.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      actionLabel="Add to Pool"
      actionIcon="UserPlus"
      onAction={() => {}}
    >
      <div className="space-y-2">
        {filtered.map((c) => (
          <Card key={c.name} className="active:bg-muted/50 md:hover:shadow-sm transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 md:h-7 md:w-7">
                  <AvatarFallback className="text-xs md:text-[10px] bg-muted">{initials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{c.name}</p>
                    <Badge variant={c.engagement === "High" ? "default" : "secondary"} className="text-[10px] shrink-0">{c.engagement}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {c.tags.map(tag => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                    {!isMobile && (
                      <span className="text-[11px] text-muted-foreground ml-1">{c.source} · {c.lastContact}</span>
                    )}
                  </div>
                  {isMobile && (
                    <p className="text-[11px] text-muted-foreground mt-1">{c.source} · {c.lastContact}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No candidates found.</p>
        )}
      </div>
    </MainPagesLayout>
  );
}
