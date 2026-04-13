import type { LucideIcon } from "lucide-react";
import { Mail, ArrowRight, UserPlus, Tag, Calendar } from "lucide-react";

export type Scope = "all" | "specific_job";
export type TriggerCategory = "candidate";

export interface TriggerOption {
  id: string;
  label: string;
  category: TriggerCategory;
  hasStageSelect?: boolean;
  hasDaysInput?: boolean;
}

export interface Action {
  id: string;
  type: string;
  label: string;
  config: Record<string, string>;
}

export interface ActionTypeDef {
  id: string;
  label: string;
  icon: LucideIcon;
  category: string;
}

export const triggerOptions: TriggerOption[] = [
  { id: "candidate_applied", label: "Candidate applied", category: "candidate" },
  {
    id: "candidate_moved",
    label: "Candidate moved to stage",
    category: "candidate",
    hasStageSelect: true,
  },
  { id: "candidate_rejected", label: "Candidate rejected", category: "candidate" },
  { id: "candidate_hired", label: "Candidate hired", category: "candidate" },
  { id: "candidate_job_assigned", label: "Candidate job assigned", category: "candidate" },
  { id: "candidate_email_received", label: "Candidate email received", category: "candidate" },
  // TODO: Re-enable "Interview scheduled" trigger once interview automation is fully supported
  // { id: "interview_scheduled", label: "Interview scheduled", category: "candidate" },
];

export const actionTypes: ActionTypeDef[] = [
  { id: "send_email", label: "Send email", icon: Mail, category: "Communication" },
  // TODO: Re-enable candidate actions (Move to stage, Assign recruiter, Add tag)
  // { id: "move_stage", label: "Move to stage", icon: ArrowRight, category: "Candidate" },
  // { id: "assign_recruiter", label: "Assign recruiter", icon: UserPlus, category: "Candidate" },
  // { id: "add_tag", label: "Add tag", icon: Tag, category: "Candidate" },
  // TODO: Re-enable interview actions (Schedule interview)
  // {
  //   id: "schedule_interview",
  //   label: "Schedule interview",
  //   icon: Calendar,
  //   category: "Interview",
  // },
];

export const stages = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];

export const emailTemplates = [
  { id: "rejection", label: "Rejection Email" },
  { id: "screening_invite", label: "Screening Invitation" },
  { id: "interview_confirm", label: "Interview Confirmation" },
  { id: "offer_letter", label: "Offer Letter" },
  { id: "welcome", label: "Welcome Email" },
];
