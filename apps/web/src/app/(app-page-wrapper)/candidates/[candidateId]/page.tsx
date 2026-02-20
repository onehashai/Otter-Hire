"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Icon } from "@onehash/ui/icon";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  OverviewTab,
  InterviewsTab,
  EvaluationTab,
  DocumentsTab,
} from "@/components/candidates/tabs";
import { SummaryPanel } from "@/components/candidates/summary/SummaryPanel";
import { ActionButtons } from "@/components/candidates/components/ActionButtons";
import { useTranslation } from "react-i18next";

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

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("overview");
  const { t } = useTranslation();
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
          <Link href="/candidates">
            <Icon name="ChevronLeft" className="h-3.5 w-3.5" /> {t("candidates")}
          </Link>
        </Button>
        <ActionButtons candidateName={candidate.name} />
      </div>

      {/* Two-column layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0">
          {[
            { value: "overview", label: t("overview") },
            { value: "interviews", label: t("interviews") },
            { value: "evaluation", label: t("evaluation") },
            { value: "documents", label: t("documents") },
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

        <div className={`mt-4 ${isMobile ? "space-y-4" : "grid grid-cols-[1fr_320px] gap-4"}`}>
          <div>
            <TabsContent value="overview" className={`mt-0 ${isMobile ? "space-y-4" : ""}`}>
              <OverviewTab timeline={candidate.timeline} notes={candidate.notes} />
            </TabsContent>
            <TabsContent value="interviews" className="mt-0">
              <InterviewsTab interviews={candidate.interviews} />
            </TabsContent>
            <TabsContent value="evaluation" className="mt-0">
              <EvaluationTab scores={candidate.scores} interviews={candidate.interviews} />
            </TabsContent>
            <TabsContent value="documents" className="mt-0">
              <DocumentsTab documents={candidate.documents} />
            </TabsContent>
          </div>
          <SummaryPanel candidate={candidate} />
        </div>
      </Tabs>
    </div>
  );
}
