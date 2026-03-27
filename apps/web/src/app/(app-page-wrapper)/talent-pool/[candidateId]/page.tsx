"use client";

import { useParams } from "next/navigation";
import { TalentPoolCandidateProfile } from "@/components/candidates/talent_pool/TalentPoolCandidateProfile";

export default function TalentPoolCandidateProfilePage() {
  const params = useParams();
  const candidateId = params?.candidateId as string | undefined;
  return <TalentPoolCandidateProfile candidateId={candidateId} />;
}
