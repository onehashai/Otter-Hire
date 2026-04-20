/**
 * Shared candidate data mapper.
 *
 * Single source of truth for converting raw API responses into the UI-ready
 * shape used by JobCandidateProfile and StandaloneCandidateProfile.
 *
 * Each component spreads mapCandidateBase() and only adds the 2–3 fields
 * that differ between views (role, stage, timeline).
 */

import type {
  CandidateDetailResponse,
  CandidateDocumentResponse,
  CandidateOverviewResponse,
} from "@/api";

// ---------------------------------------------------------------------------
// Internal raw types (matching backend canonical.py)
// ---------------------------------------------------------------------------

interface RawWorkExperience {
  company?: string | null;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  highlights?: string[];
}

interface RawSkill {
  name?: string | null;
  category?: string | null;
}

interface RawEducation {
  institution?: string | null;
  degree?: string | null;
  field?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  grade_value?: string | null;
  grade_type?: string | null;
  grade_max?: string | null;
}

interface RawCertification {
  name?: string | null;
  issuer?: string | null;
  date?: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers — date parsing & experience calculation
// ---------------------------------------------------------------------------

function parseResumeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "present" || trimmed === "current" || trimmed === "now") return null;

  // ISO: "2020", "2020-01", "2020-01-15"
  const isoMatch = trimmed.match(/^(\d{4})(?:-(\d{2}))?(?:-\d{2})?$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = isoMatch[2] ? parseInt(isoMatch[2], 10) - 1 : 0;
    return new Date(year, month, 1);
  }

  // "Jan 2020", "January 2020", "Jan. 2020"
  const monthYear = trimmed.match(
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*\s+(\d{4})$/i,
  );
  if (monthYear) {
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const month = months[monthYear[1].toLowerCase().slice(0, 3)];
    const year = parseInt(monthYear[2], 10);
    if (month !== undefined) return new Date(year, month, 1);
  }

  // "2020 Jan", "2020 January"
  const yearMonth = trimmed.match(
    /^(\d{4})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*$/i,
  );
  if (yearMonth) {
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const year = parseInt(yearMonth[1], 10);
    const month = months[yearMonth[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) return new Date(year, month, 1);
  }

  // Fallback: native Date parse
  const native = new Date(value);
  return isNaN(native.getTime()) ? null : native;
}

function formatDateLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "present" || trimmed === "current" || trimmed === "now") return "Present";
  const d = parseResumeDate(value);
  if (!d) return value;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function calcYearsOfExperience(
  entries: RawWorkExperience[],
  asOf: Date = new Date(),
): number | null {
  type Range = [number, number];
  const ranges: Range[] = [];

  for (const entry of entries) {
    const start = parseResumeDate(entry.start_date);
    if (!start) continue;
    const end = parseResumeDate(entry.end_date) ?? asOf;
    if (end < start) continue;
    ranges.push([start.getTime(), end.getTime()]);
  }

  if (ranges.length === 0) return null;

  // Merge overlapping ranges to avoid double-counting concurrent jobs
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr[0] <= last[1]) {
      last[1] = Math.max(last[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }

  const totalMs = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
  return Math.floor(totalMs / (1000 * 60 * 60 * 24 * 365.25));
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MappedDocument {
  id: string;
  name: string;
  type: string;
  date: string;
  size: string;
  url: string;
}

export interface MappedNote {
  user: string;
  date: string;
  text: string;
  mentions: Array<{ user_id: string; name: string | null; email: string }>;
}

export interface MappedEducation {
  degree: string | null;
  field: string | null;
  institution: string | null;
  /** Formatted "Mon YYYY" or raw string */
  startDate: string | null;
  endDate: string | null;
  /** The score/GPA/percentage as-extracted (e.g. "3.8", "85%", "A+") */
  gradeValue: string | null;
  /** "gpa" | "percentage" | "marks" | "grade" | null */
  gradeType: string | null;
  /** Denominator, e.g. "4.0" or "100" */
  gradeMax: string | null;
}

export interface MappedWorkExperience {
  company: string | null;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  highlights: string[];
}

export interface MappedCertification {
  name: string;
  issuer: string | null;
  date: string | null;
}

export interface CandidateBase {
  name: string;
  email: string;
  phone: string;
  address: string;
  source: string;
  appliedDate: string;
  documents: MappedDocument[];
  profileLinks: Record<string, string>;
  tags: string[];
  notes: MappedNote[];
  /** All skills from parsed resume */
  skills: string[];
  /** Total years of experience (null when no parseable dates) */
  yearsOfExperience: number | null;
  /** All education entries, most recent first */
  allEducation: MappedEducation[];
  /** All work experience entries */
  workExperiences: MappedWorkExperience[];
  /** All certifications */
  certifications: MappedCertification[];
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Maps all shared candidate fields.
 * Each profile component spreads this result and adds only its own divergent
 * fields (role, stage, timeline).
 */
export function mapCandidateBase(
  candidate: CandidateDetailResponse,
  documents: CandidateDocumentResponse[],
  overview: CandidateOverviewResponse | null | undefined,
): CandidateBase {
  // --- documents ---
  const mappedDocuments: MappedDocument[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.doc_type,
    date: new Date(d.created_at).toLocaleDateString(),
    size: d.size_label ?? "—",
    url: d.url,
  }));

  // --- notes ---
  const mappedNotes: MappedNote[] = (overview?.notes ?? []).map((n) => ({
    user: n.author_name ?? "Unknown",
    date: n.created_at,
    text: n.content,
    mentions: n.mentions,
  }));

  // --- resume insights ---
  const parsedResume = candidate.parsed_resume as Record<string, unknown> | null | undefined;
  let skills: string[] = [];
  let yearsOfExperience: number | null = null;
  let allEducation: MappedEducation[] = [];
  let workExperiences: MappedWorkExperience[] = [];
  let certifications: MappedCertification[] = [];

  if (parsedResume && typeof parsedResume === "object") {
    // --- Skills ---
    const rawSkills = parsedResume.skills;
    if (Array.isArray(rawSkills)) {
      skills = (rawSkills as (RawSkill | string)[])
        .map((s) =>
          typeof s === "object" && s !== null ? ((s as RawSkill).name ?? "") : String(s),
        )
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
    }

    // --- Work Experience ---
    const rawExp = parsedResume.work_experience;
    if (Array.isArray(rawExp)) {
      workExperiences = (rawExp as RawWorkExperience[]).map((e) => ({
        company: e.company?.trim() || null,
        title: e.title?.trim() || null,
        startDate: formatDateLabel(e.start_date),
        endDate: e.end_date
          ? ["present", "current", "now"].includes(e.end_date.trim().toLowerCase())
            ? "Present"
            : formatDateLabel(e.end_date)
          : null,
        location: e.location?.trim() || null,
        highlights: (e.highlights ?? []).filter(
          (h) => typeof h === "string" && h.trim().length > 0,
        ),
      }));
      yearsOfExperience = calcYearsOfExperience(rawExp as RawWorkExperience[]);
    }

    // --- Education — deduplicate then sort most recent first ---
    const rawEdu = parsedResume.education;
    if (Array.isArray(rawEdu) && rawEdu.length > 0) {
      // Deduplicate: if same (degree, institution) appears more than once, keep the
      // entry that has the most non-null fields (e.g. one with field set vs one without)
      const deduped: RawEducation[] = [];
      for (const entry of rawEdu as RawEducation[]) {
        const key = `${(entry.degree ?? "").toLowerCase().trim()}|${(entry.institution ?? "").toLowerCase().trim()}`;
        const existingIdx = deduped.findIndex(
          (e) =>
            `${(e.degree ?? "").toLowerCase().trim()}|${(e.institution ?? "").toLowerCase().trim()}` ===
            key,
        );
        if (existingIdx === -1) {
          deduped.push(entry);
        } else {
          // Score by number of non-null fields — keep whichever has more data
          const score = (e: RawEducation) =>
            [e.field, e.start_date, e.end_date, e.grade_value, e.grade_type, e.grade_max].filter(
              (v) => v != null && String(v).trim().length > 0,
            ).length;
          if (score(entry) > score(deduped[existingIdx])) {
            deduped[existingIdx] = entry;
          }
        }
      }

      const sorted = deduped.slice().sort((a, b) => {
        const da = parseResumeDate(a.end_date);
        const db = parseResumeDate(b.end_date);
        // null end_date (ongoing/unknown) floats to top
        if (!da && !db) return 0;
        if (!da) return -1;
        if (!db) return 1;
        return db.getTime() - da.getTime();
      });

      allEducation = sorted.map((e) => ({
        degree: e.degree?.trim() || null,
        field: e.field?.trim() || null,
        institution: e.institution?.trim() || null,
        startDate: formatDateLabel(e.start_date),
        endDate: e.end_date
          ? ["present", "current", "now"].includes(e.end_date.trim().toLowerCase())
            ? "Present"
            : formatDateLabel(e.end_date)
          : null,
        gradeValue: e.grade_value?.trim() || null,
        gradeType: e.grade_type?.trim() || null,
        gradeMax: e.grade_max?.trim() || null,
      }));
    }

    // --- Certifications ---
    const rawCerts = parsedResume.certifications;
    if (Array.isArray(rawCerts)) {
      certifications = (rawCerts as (RawCertification | string)[])
        .map((c) => {
          if (typeof c === "string") return { name: c.trim(), issuer: null, date: null };
          const rc = c as RawCertification;
          return {
            name: rc.name?.trim() || "Untitled",
            issuer: rc.issuer?.trim() || null,
            date: formatDateLabel(rc.date),
          };
        })
        .filter((c) => c.name && c.name !== "Untitled");
    }
  }

  return {
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone ?? "—",
    address: candidate.address ?? "—",
    source: candidate.source ?? "job_portal",
    appliedDate: candidate.created_at,
    documents: mappedDocuments,
    profileLinks: (candidate.profile_links ?? {}) as Record<string, string>,
    tags: candidate.tags ?? [],
    notes: mappedNotes,
    skills,
    yearsOfExperience,
    allEducation,
    workExperiences,
    certifications,
  };
}
