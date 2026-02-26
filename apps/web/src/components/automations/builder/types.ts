import type { LucideIcon } from "lucide-react";
import { Mail, Bell, MessageSquare, ArrowRight, UserPlus, Tag, X, Calendar } from "lucide-react";

export type Scope = "all" | "specific_job" | "specific_pipeline";
export type TriggerCategory = "candidate" | "job" | "time-based";

export interface TriggerOption {
  id: string;
  label: string;
  category: TriggerCategory;
  hasStageSelect?: boolean;
  hasDaysInput?: boolean;
}

export interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
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
  { id: "interview_scheduled", label: "Interview scheduled", category: "candidate" },
  { id: "job_published", label: "Job published", category: "job" },
  { id: "job_closed", label: "Job closed", category: "job" },
  {
    id: "days_after_application",
    label: "X days after application",
    category: "time-based",
    hasDaysInput: true,
  },
  {
    id: "days_in_stage",
    label: "X days in stage",
    category: "time-based",
    hasDaysInput: true,
    hasStageSelect: true,
  },
  {
    id: "before_interview",
    label: "Before interview",
    category: "time-based",
    hasDaysInput: true,
  },
];

export const conditionFields = [
  { value: "rating", label: "Candidate rating" },
  { value: "job", label: "Job equals" },
  { value: "source", label: "Source equals" },
  { value: "stage", label: "Stage equals" },
  { value: "experience", label: "Years of experience" },
];

export const conditionOperators = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" },
  { value: "contains", label: "contains" },
];

export const actionTypes: ActionTypeDef[] = [
  { id: "send_email", label: "Send email", icon: Mail, category: "Communication" },
  { id: "send_notification", label: "Send notification", icon: Bell, category: "Communication" },
  { id: "add_note", label: "Add note", icon: MessageSquare, category: "Communication" },
  { id: "move_stage", label: "Move to stage", icon: ArrowRight, category: "Candidate" },
  { id: "assign_recruiter", label: "Assign recruiter", icon: UserPlus, category: "Candidate" },
  { id: "add_tag", label: "Add tag", icon: Tag, category: "Candidate" },
  { id: "reject", label: "Reject candidate", icon: X, category: "Candidate" },
  {
    id: "schedule_interview",
    label: "Schedule interview",
    icon: Calendar,
    category: "Interview",
  },
];

export const stages = ["Applied", "Screening", "Interview", "Offer", "Hired"];

export const emailTemplates = [
  { id: "rejection", label: "Rejection Email" },
  { id: "screening_invite", label: "Screening Invitation" },
  { id: "interview_confirm", label: "Interview Confirmation" },
  { id: "offer_letter", label: "Offer Letter" },
  { id: "welcome", label: "Welcome Email" },
];
