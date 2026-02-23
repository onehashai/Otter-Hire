export type JobHiringStageResponse = {
    id: string;
    name: string;
    position: number;
};

export type JobTeamMemberResponse = {
    id: string;
    user_id: string;
    name: string | null;
    email: string | null;
    role: string;
};


export type JobListItemResponse = {
    id: string;
    title: string;
    department: string | null;
    employment_type: string | null;
    status: string;
    candidate_count: number;
    created_at: string;
    updated_at: string;
};

export type JobDetailResponse = {
    id: string;
    title: string;
    department: string | null;
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
    description: string | null;
    status: string;
    visibility: string;
    collect_resume: boolean;
    collect_cover: boolean;
    screening_questions: string[];
    pipeline_template: string | null;
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
    department?: string | null;
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
    description?: string | null;
    collect_resume?: boolean;
    collect_cover?: boolean;
    screening_questions?: string[];
    pipeline_template?: string;
    hiring_stages?: { name: string; position: number }[];
    team_members?: { user_id: string; role: string }[];
  };