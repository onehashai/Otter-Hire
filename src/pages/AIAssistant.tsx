import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bot, Send } from "lucide-react";

const AIAssistant = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <Bot className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-1">AI Assistant</h2>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Ask me anything about your hiring pipeline, candidates, or let me help draft job descriptions and outreach messages.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["Summarize top candidates", "Draft a job description", "Interview questions for React role"].map((s) => (
              <Button key={s} variant="outline" size="sm" className="text-xs h-7">{s}</Button>
            ))}
          </div>
        </CardContent>
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input placeholder="Ask the AI assistant..." className="text-sm" />
            <Button size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AIAssistant;
