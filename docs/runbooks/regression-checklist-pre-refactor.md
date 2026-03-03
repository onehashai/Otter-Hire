# Regression Checklist (Pre-Refactor Freeze)

Run this checklist before and after each refactor slice.

## 1) Platform health
- `docker compose ps`
- Ensure `backend`, `backend-worker`, `web`, `temporal`, `postgres`, `redis` are up.

## 2) Auth/session baseline
- Login as owner user.
- Validate `/auth/me` returns `200` and expected `org_id`.

## 3) Candidate list baseline
- Open `/candidates` and confirm list loads.
- API sanity:
  - `GET /candidates/paginated?limit=20&offset=0` returns expected non-zero items.

## 4) Inbound processing baseline
- Confirm new S3 raw key appears.
- Enqueue via `/public/inbound/s3-event` (manual fallback if SNS not wired).
- Verify Temporal workflow reaches completed state.
- Verify `inbound_emails` row exists with expected `parse_status`.
- For resume email: confirm `parsed_candidate_id` populated and candidate row exists.

## 5) Websocket/live update baseline
- Keep `/candidates` open.
- Process one inbound resume email.
- Confirm candidate appears without manual refresh (or within polling fallback window).

## 6) Safety checks
- Backend lint: `docker compose exec -T backend ruff check app`
- Compose parse: `docker compose config > /dev/null`

## Exit Criteria
All above pass with no new errors in `docker compose logs web` and `docker compose logs backend`.
