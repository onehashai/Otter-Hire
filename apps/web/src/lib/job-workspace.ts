/** First stage named "Applied" (case-insensitive), else first stage by position. */
export function getDefaultStageId(
  stages: { id: string; name: string; position: number }[],
): string | null {
  if (!stages.length) return null;
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  const applied = sorted.find((s) => s.name.trim().toLowerCase() === "applied");
  return (applied ?? sorted[0]).id;
}
