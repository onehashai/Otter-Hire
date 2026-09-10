"use client";

import { useParams } from "next/navigation";
import { StandaloneCandidateProfile } from "@/components/candidates/StandaloneCandidateProfile";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

export default function CandidatesCandidateProfilePage() {
  const params = useParams();
  const candidateId = params?.candidateId as string | undefined;
  return (
    <ErrorBoundary>
      <StandaloneCandidateProfile candidateId={candidateId} />
    </ErrorBoundary>
  );
}
