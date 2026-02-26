"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { InputField } from "@onehash/ui/input";
import { Button } from "@onehash/ui/button";
import { Bot, Send } from "lucide-react";

export default function AIAssistantPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-180px)]">
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col items-center justify-center p-4 md:p-6">
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-muted flex items-center justify-center mb-3 md:mb-4">
            <Bot className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
          </div>
          <h2 className="text-base md:text-lg font-semibold mb-1">AI Assistant</h2>
          <p className="text-xs md:text-sm text-muted-foreground text-center max-w-sm">
            Ask me anything about your hiring pipeline, candidates, or let me help draft job
            descriptions.
          </p>
          <div className="flex flex-wrap gap-2 mt-4 md:mt-6 justify-center">
            {["Summarize candidates", "Draft job description", "Interview questions"].map((s) => (
              <Button key={s} variant="outline" size="sm" className="text-xs h-8 md:h-7">
                {s}
              </Button>
            ))}
          </div>
        </CardContent>
        <div className="border-t border-border p-3 md:p-4">
          <div className="flex gap-2">
            <InputField placeholder="Ask the AI assistant..." className="text-sm h-10 md:h-9" />
            <Button size="icon" className="shrink-0 h-10 w-10 md:h-9 md:w-9">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
