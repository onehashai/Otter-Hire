import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarPlus, Video } from "lucide-react";

const interviews = [
  { candidate: "Alex Rivera", role: "Sr. Frontend Engineer", time: "10:00 AM", interviewer: "Sarah M.", type: "Technical", link: true },
  { candidate: "Jordan Lee", role: "Engineering Manager", time: "11:30 AM", interviewer: "Mike T.", type: "Cultural", link: true },
  { candidate: "Sam Chen", role: "Data Scientist", time: "2:00 PM", interviewer: "Lisa K.", type: "Screening", link: false },
  { candidate: "Emma Wilson", role: "Frontend Engineer", time: "3:30 PM", interviewer: "Sarah M.", type: "Technical", link: true },
];

const Interviews = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs">Today</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">This Week</Button>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5">
          <CalendarPlus className="h-3.5 w-3.5" /> Schedule
        </Button>
      </div>

      <div className="space-y-2">
        {interviews.map((i) => (
          <Card key={i.candidate + i.time} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[52px]">
                  <p className="text-sm font-medium">{i.time}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px] bg-muted">{i.candidate.split(" ").map(n => n[0]).join("")}</AvatarFallback>
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Interviews;
