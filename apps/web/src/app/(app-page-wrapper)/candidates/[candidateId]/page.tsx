"use client";

import { useParams } from "next/navigation";
import { StandaloneCandidateProfile } from "@/components/candidates/StandaloneCandidateProfile";

export default function CandidatesCandidateProfilePage() {
  const params = useParams();
  const candidateId = params?.candidateId as string | undefined;
  return <StandaloneCandidateProfile candidateId={candidateId} />;
}
