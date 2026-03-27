import { TFunction } from "i18next";
import { Country } from "country-state-city";

export const JobCategories = [
  "Software Development",
  "Product Management",
  "Design",
  "Data Analytics",
  "Marketing",
  "Sales",
  "Customer Support",
  "Human Resources",
  "Finance",
  "Operations",
] as const;
export type JobCategory = (typeof JobCategories)[number];

export const employmentTypes = ["full_time", "part_time", "contract", "internship"] as const;
export type EmploymentType = (typeof employmentTypes)[number];

export const workplaceTypes = ["remote", "hybrid", "onsite"] as const;
export type WorkplaceType = (typeof workplaceTypes)[number];

export const visibilityTypes = ["internal", "public"] as const;
export type VisibilityType = (typeof visibilityTypes)[number];

export const salaryTypes = ["hidden", "fixed", "range"] as const;
export type SalaryType = (typeof salaryTypes)[number];

export const timeframes = ["per_year", "per_month", "per_week", "per_day", "per_hour"] as const;
export type TimeframeType = (typeof timeframes)[number];

export const teamRoles = ["hiring_manager", "recruiter", "interviewer", "coordinator"] as const;
export type TeamRoleType = (typeof teamRoles)[number];

export const jobStatuses = ["draft", "open", "archived"] as const;
export type JobStatusType = (typeof jobStatuses)[number];

export function getCountryName(isoCode: string): string {
  return Country.getCountryByCode(isoCode)?.name ?? isoCode;
}

export const CITY_VALUE_SEP = "|";

export function getCityDisplayName(city: string): string {
  return city.split(CITY_VALUE_SEP)[0] || city;
}

const setupSectionDefs = [
  { slug: "info", key: "job_info" },
  { slug: "description", key: "job_description" },
  { slug: "distribution", key: "distribution" },
  { slug: "application", key: "application_form" },
  { slug: "stages", key: "hiring_stages" },
  { slug: "team", key: "hiring_team" },
] as const;

export type SetupStepSlug = (typeof setupSectionDefs)[number]["slug"];

export const SETUP_SECTIONS = (t: TFunction<"translation", undefined>) =>
  setupSectionDefs.map(({ slug, key }) => ({
    slug,
    label: t(key),
  }));

export type HiringStage = {
  id: string;
  name: string;
  isRequired?: boolean;
};

export type TeamMember = {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  role: TeamRoleType;
  userRole?: string | null;
};

export const teamRoleLabels: Record<TeamRoleType, string> = {
  hiring_manager: "Hiring Manager",
  recruiter: "Recruiter",
  interviewer: "Interviewer",
  coordinator: "Coordinator",
};
