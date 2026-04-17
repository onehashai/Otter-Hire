export type JobHiringStageResponse = {
  id: string;
  name: string;
  position: number;
  is_required: boolean;
};

export type JobTeamMemberResponse = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  user_role: string | null;
  avatar_url?: string | null;
};

export type JobWorkspaceCandidateResponse = {
  id: string;
  name: string;
  email: string | null;
  stage_id: string | null;
  created_at: string;
  updated_at: string;
};

export type JobWorkspaceResponse = {
  id: string;
  title: string;
  status: string;
  stages: JobHiringStageResponse[];
  candidates: JobWorkspaceCandidateResponse[];
};

export type JobListItemResponse = {
  id: string;
  title: string;
  category: string | null;
  employment_type: string | null;
  status: string;
  candidate_count: number;
  created_at: string;
  updated_at: string;
};

export type JobDetailResponse = {
  id: string;
  title: string;
  category: string | null;
  employment_type: string | null;
  workplace_type: string | null;
  country: string | null;
  city: string | null;
  openings: number;
  salary_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_fixed: number | null;
  currency: string | null;
  salary_timeframe: string | null;
  post_to_linkedin: boolean;
  linkedin_sync_status: string | null;
  linkedin_external_job_id: string | null;
  linkedin_last_synced_at: string | null;
  linkedin_last_error: string | null;
  description: string | null;
  status: string;
  visibility: string;
  collect_resume: boolean;
  collect_cover: boolean;
  screening_questions: string[];
  application_form_schema: Record<string, unknown>;
  hiring_stages: JobHiringStageResponse[];
  team_members: JobTeamMemberResponse[];
  created_by_user_id: string;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobUpdatePayload = {
  title?: string;
  category?: string | null;
  employment_type?: string | null;
  workplace_type?: string;
  country?: string | null;
  city?: string | null;
  openings?: number;
  salary_type?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_fixed?: number | null;
  currency?: string;
  salary_timeframe?: string;
  post_to_linkedin?: boolean;
  description?: string | null;
  collect_resume?: boolean;
  collect_cover?: boolean;
  screening_questions?: string[];
  application_form_schema?: Record<string, unknown>;
  hiring_stages?: { id?: string; name: string; position: number }[];
  team_members?: { user_id: string; role: string }[];
};
