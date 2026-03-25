"use client";

import { useParams } from "next/navigation";
import { JobCandidateProfile } from "@/components/candidates/job_candidates/JobCandidateProfile";

export default function JobCandidateProfilePage() {
  const params = useParams();
  const jobId = params?.jobId as string | undefined;
  const candidateId = params?.candidateId as string | undefined;
  return <JobCandidateProfile candidateId={candidateId} jobRouteJobId={jobId} />;
}
