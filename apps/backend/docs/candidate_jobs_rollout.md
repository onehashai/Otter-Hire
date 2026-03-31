# Candidate_jobs Rollout and Observability

This checklist is for staged production rollout of `Candidate_jobs` with `assigned_id`.

## 1) Pre-rollout

- Run migrations through `u1v2w3x4y5z6_add_candidate_jobs_table`.
- Validate backfill using [`candidate_jobs_backfill_validation.sql`](./candidate_jobs_backfill_validation.sql).
- Candidate jobs is permanently enabled at code level.

## 2) Pilot rollout

- Roll out by deployment sequence (dev -> staging -> production) without env toggles.
- Exercise flows:
  - create candidate with job
  - update candidate job
  - bulk assign candidates to job
  - public job apply
- Verify automation metadata includes `assigned_id`.

## 3) Monitoring during pilot

- Check reconciliation endpoint:
  - `GET /v1/internal/candidates/assignments/reconciliation-report`
- Expected metrics:
  - `missing_assignments_count = 0`
  - `stage_mismatch_count = 0`
  - `candidate_jobs_rows >= candidate_with_legacy_job_count`

## 4) Gradual expansion

- Expand by tenant cohorts only after metrics are stable for 48h.
- Keep dual-write active during expansion.
- Run validation SQL daily in production read replica.

## 5) Legacy deprecation readiness (future release)

Do not drop legacy `candidates.job_id` / `candidates.stage_id` until:
- dual-write has been stable for at least one full release cycle,
- reconciliation endpoint stays healthy,
- no legacy reads remain in API/web,
- rollback playbook has been tested.
