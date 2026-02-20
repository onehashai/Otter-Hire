"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Separator,
  Textarea,
  Progress,
  Icon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@onehash/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

// Mock data
const candidatesData: Record<string, any> = {
  "1": {
    id: "1",
    name: "Alex Rivera",
    email: "alex@example.com",
    phone: "+1 555-0101",
    location: "San Francisco, CA",
    role: "Sr. Frontend Engineer",
    stage: "Interview",
    rating: 4.5,
    recruiter: "Sarah Miller",
    source: "LinkedIn",
    tags: ["React", "TypeScript", "GraphQL", "Node.js"],
    linkedin: "linkedin.com/in/alexrivera",
    portfolio: "alexrivera.dev",
    coverLetter: true,
    appliedDate: "Feb 15, 2025",
    timeline: [
      { action: "Applied", date: "Feb 15, 2025", user: "Alex Rivera", icon: "apply" },
      { action: "Moved to Screening", date: "Feb 16, 2025", user: "Sarah Miller", icon: "move" },
      { action: "Screening feedback added", date: "Feb 17, 2025", user: "Sarah Miller", icon: "feedback" },
      { action: "Moved to Interview", date: "Feb 18, 2025", user: "Sarah Miller", icon: "move" },
    ],
    interviews: [
      {
        id: "i1",
        title: "Technical Interview",
        date: "Feb 20, 2025",
        time: "2:00 PM",
        interviewer: "John Davis",
        status: "Completed",
        rating: 4,
        decision: "Pass",
        feedback: "Strong React and TypeScript skills. Good system design thinking.",
      },
      {
        id: "i2",
        title: "Culture Fit",
        date: "Feb 22, 2025",
        time: "10:00 AM",
        interviewer: "Sarah Miller",
        status: "Scheduled",
        rating: null,
        decision: null,
        feedback: null,
      },
    ],
    scores: { technical: 4.5, communication: 4.0, cultureFit: 4.2, overall: 4.2 },
    documents: [
      { name: "Resume_Alex_Rivera.pdf", type: "Resume", date: "Feb 15, 2025", size: "245 KB" },
      { name: "Portfolio_Summary.pdf", type: "Attachment", date: "Feb 15, 2025", size: "1.2 MB" },
    ],
    activityLog: [
      { action: "Candidate applied via LinkedIn", date: "Feb 15, 2025 9:30 AM", user: "System" },
      { action: "Moved from Applied to Screening", date: "Feb 16, 2025 10:15 AM", user: "Sarah Miller" },
      { action: "Screening notes added", date: "Feb 17, 2025 3:45 PM", user: "Sarah Miller" },
      { action: "Moved from Screening to Interview", date: "Feb 18, 2025 11:00 AM", user: "Sarah Miller" },
      { action: "Technical interview scheduled", date: "Feb 18, 2025 11:30 AM", user: "Sarah Miller" },
      { action: "Technical interview completed", date: "Feb 20, 2025 3:00 PM", user: "John Davis" },
      { action: "Interview feedback submitted", date: "Feb 20, 2025 4:15 PM", user: "John Davis" },
    ],
    notes: [
      {
        user: "Sarah Miller",
        date: "Feb 17, 2025",
        text: "Strong resume. 7+ years experience. Good culture fit potential based on screening call.",
      },
      {
        user: "John Davis",
        date: "Feb 20, 2025",
        text: "Excellent technical depth. Solved the system design question with a scalable approach. Recommended for next round.",
      },
    ],
  },
};

// Fill other candidate IDs with variant data
["2", "3", "4", "5", "6", "7"].forEach((id) => {
  const names: Record<string, string> = {
    "2": "Maria Kim",
    "3": "Sam Chen",
    "4": "Jordan Lee",
    "5": "Taylor Morgan",
    "6": "Casey Brooks",
    "7": "Riley Parker",
  };
  const roles: Record<string, string> = {
    "2": "Product Designer",
    "3": "Data Scientist",
    "4": "Engineering Manager",
    "5": "Marketing Lead",
    "6": "Sr. Frontend Engineer",
    "7": "Product Designer",
  };
  const stages: Record<string, string> = {
    "2": "Offer",
    "3": "Screening",
    "4": "Interview",
    "5": "Applied",
    "6": "Hired",
    "7": "Rejected",
  };
  const ratings: Record<string, number> = {
    "2": 4.2,
    "3": 3.8,
    "4": 4.0,
    "5": 3.5,
    "6": 4.8,
    "7": 2.5,
  };
  candidatesData[id] = {
    ...candidatesData["1"],
    id,
    name: names[id],
    email: `${names[id].split(" ")[0].toLowerCase()}@example.com`,
    role: roles[id],
    stage: stages[id],
    rating: ratings[id],
    tags: ["Skill A", "Skill B"],
    timeline: [{ action: "Applied", date: "Feb 10, 2025", user: names[id], icon: "apply" }],
    interviews: [],
    notes: [],
    documents: [
      {
        name: `Resume_${names[id].replace(" ", "_")}.pdf`,
        type: "Resume",
        date: "Feb 10, 2025",
        size: "200 KB",
      },
    ],
    activityLog: [{ action: "Candidate applied", date: "Feb 10, 2025", user: "System" }],
    scores: {
      technical: ratings[id],
      communication: ratings[id] - 0.3,
      cultureFit: ratings[id] - 0.1,
      overall: ratings[id] - 0.1,
    },
  };
});

const stageVariant = (stage: string) => {
  if (stage === "Hired") return "default" as const;
  if (stage === "Rejected") return "destructive" as const;
  return "secondary" as const;
};

const ScoreBar = ({ label, score }: { label: string; score: number }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{score.toFixed(1)}/5</span>
    </div>
    <Progress value={score * 20} className="h-1.5" />
  </div>
);

const TimelineIcon = ({ type }: { type: string }) => {
  const cls = "h-3.5 w-3.5";
  if (type === "apply") return <Icon name="Users" className={cls} />;
  if (type === "move") return <Icon name="UserCheck" className={cls} />;
  if (type === "feedback") return <Icon name="Send" className={cls} />;
  return <Icon name="Clock" className={cls} />;
};

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const id = params?.candidateId as string | undefined;
  const candidate = id ? candidatesData[id] : undefined;

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-muted-foreground">Candidate not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/candidates")}>
          <Icon name="ChevronLeft" className="h-3.5 w-3.5 mr-1.5" /> Back to Candidates
        </Button>
      </div>
    );
  }

  const initials = candidate.name.split(" ").map((n: string) => n[0]).join("");

  const ActionButtons = () => (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => toast({ title: "Stage updated" })}
      >
        <Icon name="UserCheck" className="h-3.5 w-3.5" /> Move Stage
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5 hidden sm:flex"
        onClick={() => toast({ title: "Interview scheduled" })}
      >
        <Icon name="Clock" className="h-3.5 w-3.5" /> Schedule
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <Icon name="MoreHorizontal" className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="text-xs"
            onClick={() => toast({ title: "Interview scheduled" })}
          >
            <Icon name="Clock" className="h-3.5 w-3.5 mr-2" /> Schedule Interview
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs"
            onClick={() => toast({ title: "Email composed" })}
          >
            <Icon name="Send" className="h-3.5 w-3.5 mr-2" /> Send Email
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs"
            onClick={() => toast({ title: "Offer created" })}
          >
            <Icon name="ScrollText" className="h-3.5 w-3.5 mr-2" /> Create Offer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onClick={() => toast({ title: "Candidate rejected", variant: "destructive" })}
          >
            <Icon name="X" className="h-3.5 w-3.5 mr-2" /> Reject
          </DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive"
                onSelect={(e) => e.preventDefault()}
              >
                <Icon name="X" className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove {candidate.name} and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="text-xs bg-destructive text-destructive-foreground"
                  onClick={() => {
                    toast({ title: "Candidate deleted" });
                    router.push("/candidates");
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  /* ─── LEFT PANEL ─── */
  const SummaryPanel = () => (
    <div className="space-y-4">
      {/* Basic Info */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-muted text-sm font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-base font-semibold">{candidate.name}</h2>
              <p className="text-xs text-muted-foreground">{candidate.role}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="Mail" className="h-3.5 w-3.5" /> {candidate.email}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="Mic" className="h-3.5 w-3.5" /> {candidate.phone}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="MapPin" className="h-3.5 w-3.5" /> {candidate.location}
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stage</p>
              <Badge variant={stageVariant(candidate.stage)} className="text-[10px] mt-1">
                {candidate.stage}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rating</p>
              <div className="flex items-center gap-1 mt-1">
                <Icon name="Crown" className="h-3 w-3 text-foreground" />
                <span className="text-sm font-medium">{candidate.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source</p>
            <Badge variant="outline" className="text-[10px]">
              {candidate.source}
            </Badge>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Applied</p>
            <span className="text-xs">{candidate.appliedDate}</span>
          </div>
        </CardContent>
      </Card>

      {/* Resume & Links */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Resume & Links
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {candidate.documents.filter((d: any) => d.type === "Resume").length > 0 ? (
            <Button variant="outline" size="sm" className="h-8 text-xs w-full justify-start gap-2">
              <Icon name="ScrollText" className="h-3.5 w-3.5" />
              <span className="truncate flex-1 text-left">{candidate.documents[0].name}</span>
              <Icon name="Link" className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-xs w-full justify-start gap-2">
              <Icon name="Upload" className="h-3.5 w-3.5" /> Upload Resume
            </Button>
          )}
          {candidate.linkedin && (
            <Button variant="ghost" size="sm" className="h-8 text-xs w-full justify-start gap-2">
              <Icon name="Link" className="h-3.5 w-3.5" /> LinkedIn
            </Button>
          )}
          {candidate.portfolio && (
            <Button variant="ghost" size="sm" className="h-8 text-xs w-full justify-start gap-2">
              <Icon name="Link" className="h-3.5 w-3.5" /> Portfolio
            </Button>
          )}
          {candidate.coverLetter && (
            <Button variant="ghost" size="sm" className="h-8 text-xs w-full justify-start gap-2">
              <Icon name="ScrollText" className="h-3.5 w-3.5" /> Cover Letter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Skills
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {candidate.tags.map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  /* ─── TAB CONTENT ─── */
  const OverviewTab = () => (
    <div className="space-y-4">
      {/* Timeline */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-3">
            {candidate.timeline.map((item: any, i: number) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <TimelineIcon type={item.icon} />
                  </div>
                  {i < candidate.timeline.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-3">
                  <p className="text-xs font-medium">{item.action}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.user} · {item.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium">Notes</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {candidate.notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notes yet.</p>
          ) : (
            candidate.notes.map((note: any, i: number) => (
              <div key={i} className="p-3 rounded-md bg-muted/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{note.user}</span>
                  <span className="text-[10px] text-muted-foreground">{note.date}</span>
                </div>
                <p className="text-xs text-muted-foreground">{note.text}</p>
              </div>
            ))
          )}
          <Textarea placeholder="Add a note..." className="text-xs min-h-[60px] resize-none" />
          <Button size="sm" className="h-7 text-xs">
            Add Note
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const InterviewsTab = () => (
    <div className="space-y-3">
      {candidate.interviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Icon name="Clock" className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No interviews scheduled</p>
            <Button size="sm" className="h-7 text-xs gap-1.5">
              <Icon name="Clock" className="h-3 w-3" /> Schedule Interview
            </Button>
          </CardContent>
        </Card>
      ) : (
        candidate.interviews.map((interview: any) => (
          <Card key={interview.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{interview.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {interview.date} at {interview.time}
                  </p>
                </div>
                <Badge
                  variant={interview.status === "Completed" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {interview.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon name="Users" className="h-3 w-3" /> {interview.interviewer}
              </div>
              {interview.feedback && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Decision:</span>
                      <Badge
                        variant={
                          interview.decision === "Pass"
                            ? "default"
                            : interview.decision === "Fail"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {interview.decision}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{interview.feedback}</p>
                  </div>
                </>
              )}
              {!interview.feedback && interview.status === "Scheduled" && (
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Reschedule
                  </Button>
                  <Button size="sm" className="h-7 text-xs">
                    Add Feedback
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
      {candidate.interviews.length > 0 && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full">
          <Icon name="Clock" className="h-3.5 w-3.5" /> Schedule Another Interview
        </Button>
      )}
    </div>
  );

  const EvaluationTab = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium">Scorecard</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <ScoreBar label="Technical Skills" score={candidate.scores.technical} />
          <ScoreBar label="Communication" score={candidate.scores.communication} />
          <ScoreBar label="Culture Fit" score={candidate.scores.cultureFit} />
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Overall</span>
            <div className="flex items-center gap-1.5">
              <Icon name="Crown" className="h-3.5 w-3.5 text-foreground" />
              <span className="text-sm font-semibold">{candidate.scores.overall.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">/ 5.0</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium">Recommendation</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-center gap-2">
            <Icon name="Check" className="h-4 w-4 text-foreground" />
            <span className="text-xs font-medium">
              {candidate.scores.overall >= 4
                ? "Strong Hire"
                : candidate.scores.overall >= 3
                  ? "Hire"
                  : "No Hire"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Based on{" "}
            {candidate.interviews.filter((i: any) => i.status === "Completed").length} completed
            evaluations.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const DocumentsTab = () => (
    <div className="space-y-3">
      {candidate.documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Icon name="ScrollText" className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No documents uploaded</p>
            <Button size="sm" className="h-7 text-xs gap-1.5">
              <Icon name="Upload" className="h-3 w-3" /> Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {candidate.documents.map((doc: any, i: number) => (
            <Card key={i}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon name="ScrollText" className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {doc.type} · {doc.size} · {doc.date}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                  <Icon name="Link" className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full">
            <Icon name="Upload" className="h-3.5 w-3.5" /> Upload Document
          </Button>
        </>
      )}
    </div>
  );

  const ActivityTab = () => (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {candidate.activityLog.map((log: any, i: number) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                {i < candidate.activityLog.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-1" />
                )}
              </div>
              <div className="pb-3 min-w-0">
                <p className="text-xs">{log.action}</p>
                <p className="text-[10px] text-muted-foreground">
                  {log.user} · {log.date}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
          <Link href="/candidates">
            <Icon name="ChevronLeft" className="h-3.5 w-3.5" /> Candidates
          </Link>
        </Button>
        <ActionButtons />
      </div>

      {/* Two-column layout */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-[1fr_320px] gap-4"}>
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0">
              {[
                { value: "overview", label: "Overview" },
                { value: "interviews", label: "Interviews" },
                { value: "evaluation", label: "Evaluation" },
                { value: "documents", label: "Documents" },
                { value: "activity", label: "Activity" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-9 px-3"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="mt-4">
              <TabsContent value="overview" className="mt-0">
                <OverviewTab />
              </TabsContent>
              <TabsContent value="interviews" className="mt-0">
                <InterviewsTab />
              </TabsContent>
              <TabsContent value="evaluation" className="mt-0">
                <EvaluationTab />
              </TabsContent>
              <TabsContent value="documents" className="mt-0">
                <DocumentsTab />
              </TabsContent>
              <TabsContent value="activity" className="mt-0">
                <ActivityTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
        <SummaryPanel />
      </div>
    </div>
  );
}
