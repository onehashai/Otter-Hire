import { TFunction } from "i18next";
import { Country } from "country-state-city";

export type EmploymentType = "full_time" | "part_time" | "contract" | "internship";
export type DepartmentType = "engineering" | "design" | "marketing" | "sales" | "data" | "operations" | "hr";
export type WorkplaceType = "remote" | "hybrid" | "onsite";
export type JobStatusType = "draft" | "open" | "closed";
export type VisibilityType = "internal" | "careers" | "public";
export type SalaryType = "hidden" | "fixed" | "range";
export type TimeframeType = "per_year" | "per_month" | "per_week" | "per_day" | "per_hour";

export function getCountryName(isoCode: string): string {
  const c = Country.getCountryByCode(isoCode);
  return c?.name ?? isoCode;
}

export const CITY_VALUE_SEP = "|";
export function getCityDisplayName(city: string): string {
  return city.includes(CITY_VALUE_SEP) ? city.split(CITY_VALUE_SEP)[0] ?? city : city;
}

export const SETUP_SECTIONS = (t: TFunction<"translation", undefined>) => [
  { slug: "info", label: t("job_info") },
  { slug: "description", label: t("job_description") },
  { slug: "details", label: t("hiring_details") },
  { slug: "application", label: t("application_form") },
] as const;

export type SetupStepSlug = ReturnType<typeof SETUP_SECTIONS>[number]["slug"];

export const employmentTypes: EmploymentType[] = [
  "full_time",
  "part_time",
  "contract",
  "internship"
];

export const departments: DepartmentType[] = [
  "engineering",
  "design",
  "marketing",
  "sales",
  "data",
  "operations",
  "hr"
];

export const workplaceTypes: WorkplaceType[] = [
  "remote",
  "hybrid",
  "onsite"
];

export const jobStatuses: JobStatusType[] = [
  "draft",
  "open",
  "closed"
];

export const salaryTypes: SalaryType[] = [
  "hidden",
  "fixed",
  "range"
];

export const timeframes: TimeframeType[] = [
  "per_year",
  "per_month",
  "per_week",
  "per_day",
  "per_hour",
];

export const visibilityTypes: VisibilityType[] = [
  "internal",
  "careers",
  "public",
];


/** Mock data for edit mode */
export const mockJob = {
  title: "Senior Frontend Engineer",
  department: "engineering",
  employmentType: "full_time",
  workplaceType: "remote",
  country: "US",
  city: "San Francisco",
  hiringManager: "Jane Doe",
  status: "draft" as JobStatusType,
  description:
    "<p>We're looking for a Senior Frontend Engineer to lead our design system efforts and build delightful user experiences.</p><h2>Responsibilities</h2><ul><li>Architect and maintain our React component library</li><li>Collaborate with design on new features</li><li>Mentor junior engineers</li></ul><h2>Requirements</h2><ul><li>5+ years of frontend experience</li><li>Strong TypeScript and React skills</li><li>Experience with design systems</li></ul>",
  openings: 2,
  salaryType: "range" as SalaryType,
  salaryFixed: "",
  salaryMin: "140000",
  salaryMax: "180000",
  currency: "USD",
  timeframe: "per_year" as TimeframeType,
  pipeline: "standard",
  collectResume: true,
  collectCover: false,
  screeningQuestions: ["Why are you interested in this role?"],
  stages: [
    { name: "Phone Screen", interviewer: "Jane Doe" },
    { name: "Technical", interviewer: "John Smith" },
    { name: "Culture Fit", interviewer: "Sarah Lee" },
    { name: "Final", interviewer: "Jane Doe" },
  ],
  visibility: "careers" as VisibilityType,
};
