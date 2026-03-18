"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Eye, Save, ChevronDown } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@onehash/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { RichTextEditor } from "@onehash/ui/editor";
import { useToast } from "@/hooks/use-toast";
import { TemplatePreviewModal } from "./components/TemplatePreviewModal";
import { getTemplateById, createTemplate, updateTemplate } from "@/api/templates";

const VARIABLES = [
  {
    group: "Candidate",
    vars: [
      { label: "Candidate Name", value: "{{candidate_name}}" },
      { label: "Candidate Email", value: "{{candidate_email}}" },
    ],
  },
  {
    group: "Job",
    vars: [
      { label: "Job Title", value: "{{job_title}}" },
      { label: "Job Location", value: "{{job_location}}" },
    ],
  },
  {
    group: "Interview",
    vars: [
      { label: "Interview Date", value: "{{interview_date}}" },
      { label: "Interviewer Name", value: "{{interviewer_name}}" },
    ],
  },
  {
    group: "Organization",
    vars: [{ label: "Company Name", value: "{{company_name}}" }],
  },
];

export default function TemplateEditor() {
  const params = useParams();
  const templateId = typeof params?.templateId === "string" ? params.templateId : undefined;
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!templateId && templateId !== "new";

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !templateId) return;
    let cancelled = false;
    getTemplateById(templateId)
      .then((t) => {
        if (!cancelled) {
          setName(t.name);
          setCategory(t.category || "Email");
          setSubject(t.subject);
          setBody(t.body || "");
        }
      })
      .catch(() => {
        if (!cancelled) toast({ title: "Failed to load template", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, templateId, toast]);

  const insertVariable = (variable: string, target: "subject" | "body") => {
    if (target === "subject") {
      setSubject((prev) => prev + variable);
    } else {
      setBody((prev) => prev + variable);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) {
      toast({ title: "Please fill in template name and subject", variant: "destructive" });
      return;
    }
    try {
      if (isEdit && templateId) {
        await updateTemplate(templateId, { name: name.trim(), category, subject: subject.trim(), body });
        toast({ title: "Template updated" });
      } else {
        await createTemplate({ name: name.trim(), category, subject: subject.trim(), body });
        toast({ title: "Template created" });
      }
      router.push("/templates");
    } catch {
      toast({ title: isEdit ? "Failed to update template" : "Failed to create template", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Loading template…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push("/templates")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-1.5" />
            Preview
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="w-full space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Template Name</Label>
            <InputField
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Interview Invitation"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Subject Line</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground">
                  Insert Variable <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {VARIABLES.map((group) => (
                  <div key={group.group}>
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
                      {group.group}
                    </DropdownMenuLabel>
                    {group.vars.map((v) => (
                      <DropdownMenuItem
                        key={v.value}
                        onClick={() => insertVariable(v.value, "subject")}
                      >
                        <code className="text-xs">{v.value}</code>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <InputField
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject…"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Message Body</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground">
                  Insert Variable <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {VARIABLES.map((group) => (
                  <div key={group.group}>
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
                      {group.group}
                    </DropdownMenuLabel>
                    {group.vars.map((v) => (
                      <DropdownMenuItem
                        key={v.value}
                        onClick={() => insertVariable(v.value, "body")}
                      >
                        <code className="text-xs">{v.value}</code>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <RichTextEditor content={body} onChange={setBody} />
        </div>
      </div>

      <TemplatePreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        subject={subject}
        body={body}
      />
    </div>
  );
}
