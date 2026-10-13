export interface CandidateNavigationContext {
  ids: string[];
  total?: number;
  sourceUrl?: string;
  sourceName?: string;
  timestamp?: number;
}

const STORAGE_KEY = "ats_candidate_navigation_context";

export function setCandidateNavigationContext(context: {
  ids: string[];
  total?: number;
  sourceUrl?: string;
  sourceName?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...context,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}

export function getCandidateNavigationContext(): CandidateNavigationContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.ids) && parsed.ids.length > 0) {
      return parsed as CandidateNavigationContext;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null;
}
