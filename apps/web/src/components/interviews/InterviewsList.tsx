"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import { Video } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export interface Interview {
  candidate: string;
  role: string;
  time: string;
  interviewer: string;
  type: string;
  link: boolean;
}

interface InterviewsListProps {
  interviews: Interview[];
}

export const InterviewsList = ({ interviews }: InterviewsListProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-2">
      {interviews.map((i) => (
        <Card key={i.candidate + i.time} className="active:bg-muted/50 md:hover:shadow-sm transition-all">
          <CardContent className={isMobile ? "p-4" : "p-4 flex items-center justify-between"}>
            {isMobile ? (
              <>
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-muted">
                      {i.candidate.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{i.candidate}</p>
                    <p className="text-xs text-muted-foreground">{i.role}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{i.time}</span>
                    <span className="text-xs text-muted-foreground">· {i.interviewer}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">{i.type}</Badge>
                    {i.link && (
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                        <Video className="h-3 w-3" /> Join
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[52px]">
                    <p className="text-sm font-medium">{i.time}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] bg-muted">
                      {i.candidate.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{i.candidate}</p>
                    <p className="text-[11px] text-muted-foreground">{i.role} · {i.interviewer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{i.type}</Badge>
                  {i.link && (
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                      <Video className="h-3 w-3" /> Join
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
