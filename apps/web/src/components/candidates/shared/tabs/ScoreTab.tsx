"use client";

import type { CandidateJobScoreResponse } from "@/api";

type ScoreTabProps = {
  scoreData: CandidateJobScoreResponse | null;
  loading?: boolean;
};

type ScoreSections = {
  skills?: number;
  experience?: number;
  education?: number;
  matched_skills?: string[];
  missing_skills?: string[];
  explanation?: {
    summary: string;
    highlights: string[];
    gaps: string[];
    scored_by: string;
  };
};

function asSections(value: unknown): ScoreSections {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ScoreSections;
}

function CircularScore({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-muted"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-foreground"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums leading-none">{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-foreground transition-[width]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function ScoreTab({ scoreData, loading = false }: ScoreTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Generating resume score...
      </div>
    );
  }

  if (!scoreData || scoreData.status !== "ready") {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No score data available
      </div>
    );
  }

  const sections = asSections(scoreData.sections);
  const sectionEntries = [
    ["Skills", sections.skills],
    ["Experience", sections.experience],
    ["Education", sections.education],
  ].filter(([, value]) => typeof value === "number") as Array<[string, number]>;

  if (!sectionEntries.length) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No score data available
      </div>
    );
  }

  const totalScore = scoreData.total_score ?? 0;
  const explanation = sections.explanation;

  return (
    <div className="space-y-6 p-1">
      {/* Top row: circular score + section bars */}
      <div className="flex items-center gap-8 rounded-xl border bg-card p-6">
        <div className="shrink-0">
          <CircularScore score={totalScore} />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          {sectionEntries.map(([name, score]) => (
            <div key={name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{name}</span>
                <span className="tabular-nums text-muted-foreground">{score}%</span>
              </div>
              <ProgressBar value={score} />
            </div>
          ))}
        </div>
      </div>

      {/* Explanation card */}
      {explanation && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">{explanation.summary}</p>
          {explanation.highlights.length > 0 && (
            <div className="space-y-1">
              {explanation.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 shrink-0">✓</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          )}
          {explanation.gaps.length > 0 && (
            <div className="space-y-1">
              {explanation.gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 shrink-0 text-destructive">✗</span>
                  <span>{g}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
