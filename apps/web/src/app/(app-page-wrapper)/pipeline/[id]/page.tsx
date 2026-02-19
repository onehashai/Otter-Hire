"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@onehash/ui";
import { ArrowLeft, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { pipelineJobs, statusVariant, type PipelineJob } from "../data";

function PipelineBoard({
  job,
  allJobs,
  onBack,
  onSwitchJob,
  isMobile,
}: {
  job: PipelineJob;
  allJobs: PipelineJob[];
  onBack: () => void;
  onSwitchJob: (id: string) => void;
  isMobile: boolean;
}) {
  const [candidates, setCandidates] = useState(job.candidates);
  const [activeStage, setActiveStage] = useState(0);
  const [dragItem, setDragItem] = useState<string | null>(null);

  useEffect(() => {
    setCandidates(job.candidates);
    setActiveStage(0);
  }, [job.id, job.candidates]);

  const candidatesByStage = (stageId: string) =>
    candidates.filter((c) => c.stageId === stageId);

  const handleDragStart = (candidateId: string) => setDragItem(candidateId);
  const handleDragEnd = () => setDragItem(null);
  const handleDrop = (stageId: string) => {
    if (!dragItem) return;
    setCandidates((prev) =>
      prev.map((c) => (c.id === dragItem ? { ...c, stageId } : c))
    );
    setDragItem(null);
  };

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("");

  if (isMobile) {
    const stage = job.stages[activeStage];
    const stageCandidates = candidatesByStage(stage.id);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link href="/pipeline">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{job.title}</h2>
            <div className="flex items-center gap-1.5">
              <Badge variant={statusVariant(job.status)} className="text-[10px]">{job.status}</Badge>
              <span className="text-[10px] text-muted-foreground">{candidates.length} candidates</span>
            </div>
          </div>
        </div>

        <Select value={job.id} onValueChange={onSwitchJob}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allJobs.filter((j) => j.status !== "Closed").map((j) => (
              <SelectItem key={j.id} value={j.id} className="text-xs">
                {j.title} · {j.candidates.length} candidates
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {job.stages.map((s, i) => {
            const count = candidatesByStage(s.id).length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStage(i)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[44px]",
                  i === activeStage ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {s.name}
                <Badge
                  variant={i === activeStage ? "outline" : "secondary"}
                  className={cn("text-[10px] h-4", i === activeStage && "border-background/30 text-background")}
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {stageCandidates.map((c) => (
            <Card key={c.id} className="active:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs bg-muted">{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{c.name}</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{c.role}</span>
                      <span className="text-xs font-medium">{c.score}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {stageCandidates.length === 0 && (
            <div className="border border-dashed border-border rounded-xl p-8 text-center">
              <p className="text-xs text-muted-foreground">No candidates in this stage</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" asChild>
          <Link href="/pipeline">
            <ArrowLeft className="h-3.5 w-3.5" /> All Jobs
          </Link>
        </Button>
        <div className="h-4 w-px bg-border" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold truncate">{job.title}</h2>
            <Badge variant={statusVariant(job.status)} className="text-[10px]">{job.status}</Badge>
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {job.stages.map((stage) => {
          const stageCandidates = candidatesByStage(stage.id);
          return (
            <div
              key={stage.id}
              className="min-w-[250px] w-[250px] shrink-0"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("bg-muted/30");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("bg-muted/30");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("bg-muted/30");
                handleDrop(stage.id);
              }}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stage.name}
                </h3>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {stageCandidates.length}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[100px] rounded-lg p-1 transition-colors">
                {stageCandidates.map((c) => (
                  <Card
                    key={c.id}
                    draggable
                    onDragStart={() => handleDragStart(c.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "cursor-grab active:cursor-grabbing hover:shadow-sm transition-all",
                      dragItem === c.id && "opacity-50"
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-muted">{initials(c.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{c.role}</span>
                        <span className="text-[11px] font-medium">{c.score}%</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {stageCandidates.length === 0 && (
                  <div className="border border-dashed border-border rounded-xl p-6 text-center">
                    <p className="text-xs text-muted-foreground">No candidates</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PipelineJobPage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const id = params?.id as string | undefined;

  const job = id ? pipelineJobs.find((j) => j.id === id) ?? null : null;
  const otherJobs = pipelineJobs.filter((j) => j.status !== "Closed");

  const handleSwitchJob = (newId: string) => {
    router.push(`/pipeline/${newId}`);
  };

  if (!id || !job) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Job not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/pipeline">Back to Pipeline</Link>
        </Button>
      </div>
    );
  }

  return (
    <PipelineBoard
      job={job}
      allJobs={pipelineJobs}
      onBack={() => router.push("/pipeline")}
      onSwitchJob={handleSwitchJob}
      isMobile={isMobile}
    />
  );
}
