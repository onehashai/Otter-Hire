"use client";

import { Button } from "@onehash/ui";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJobSetup } from "../context";

export default function VisibilityPage() {
  const { visibility, setVisibility, published, linkCopied, handleCopyLink } = useJobSetup();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Job Visibility</p>
        <div className="space-y-2">
          {([
            { val: "internal", label: "Internal Only", desc: "Only visible to your team" },
            { val: "careers", label: "Careers Page", desc: "Visible on your careers site" },
            { val: "public", label: "Public Link", desc: "Shareable public URL" },
          ] as const).map((opt) => (
            <button
              key={opt.val}
              onClick={() => setVisibility(opt.val)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
                visibility === opt.val
                  ? "border-foreground bg-muted/50"
                  : "border-border hover:bg-muted/30"
              )}
            >
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
              {visibility === opt.val && (
                <div className="h-4 w-4 rounded-full bg-foreground flex items-center justify-center shrink-0">
                  <Check className="h-2.5 w-2.5 text-background" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      {published && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Shareable Link</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground truncate">
              https://careers.acme.com/jobs/senior-frontend
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5 shrink-0"
              onClick={handleCopyLink}
            >
              {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {linkCopied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
