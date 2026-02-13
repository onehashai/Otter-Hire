import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search } from "lucide-react";

const threads = [
  { name: "Alex Rivera", preview: "Thanks for the update on the interview...", time: "2h ago", unread: true },
  { name: "Maria Kim", preview: "I'd like to accept the offer! When can...", time: "5h ago", unread: true },
  { name: "Sam Chen", preview: "Could you share more details about...", time: "1d ago", unread: false },
  { name: "Jordan Lee", preview: "Looking forward to meeting the team...", time: "2d ago", unread: false },
];

const Messages = () => {
  return (
    <div className="flex gap-4 h-[calc(100vh-180px)]">
      {/* Thread List */}
      <div className="w-80 shrink-0 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search messages..." className="h-8 pl-8 text-xs" />
        </div>
        <div className="space-y-1">
          {threads.map((t, i) => (
            <div
              key={t.name}
              className={`flex items-start gap-2.5 rounded-lg p-2.5 cursor-pointer transition-colors ${i === 0 ? "bg-muted" : "hover:bg-muted/50"}`}
            >
              <Avatar className="h-7 w-7 mt-0.5">
                <AvatarFallback className="text-[10px] bg-muted">{t.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground">{t.time}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{t.preview}</p>
              </div>
              {t.unread && <div className="h-1.5 w-1.5 rounded-full bg-ring mt-2 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Message Detail */}
      <Card className="flex-1">
        <CardContent className="p-6 flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">Select a conversation to view messages</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Messages;
