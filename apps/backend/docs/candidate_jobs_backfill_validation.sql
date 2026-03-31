-- Candidate_jobs backfill validation queries

-- 1) Row count parity: placements vs candidates with job_id.
SELECT
  (SELECT COUNT(*) FROM "Candidate_jobs") AS candidate_jobs_rows,
  (SELECT COUNT(*) FROM candidates WHERE job_id IS NOT NULL) AS candidates_with_job;

-- 2) Duplicate safety check for (candidate_id, job_id).
SELECT candidate_id, job_id, COUNT(*) AS dup_count
FROM "Candidate_jobs"
GROUP BY candidate_id, job_id
HAVING COUNT(*) > 1;

-- 3) Stage ownership consistency: stage.job_id should match placement job_id.
SELECT cj.assigned_id, cj.candidate_id, cj.job_id AS assignment_job_id, s.job_id AS stage_job_id
FROM "Candidate_jobs" cj
JOIN stages s ON s.id = cj.stage_id
WHERE cj.stage_id IS NOT NULL
  AND cj.job_id <> s.job_id;
