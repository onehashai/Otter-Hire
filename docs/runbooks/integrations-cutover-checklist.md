# Integrations Cutover Checklist

Use this after completing integrations modularization.

## Goals
- Integrations routes are the only inbox API surface.
- Legacy org inbox API routes are removed.
- Integrations UI and old deep links still work.

## Commands

1. Rebuild services
- `docker compose up -d --build backend backend-worker web`

2. Backend lint
- `docker compose exec -T backend ruff check app`

3. Frontend lint
- `docker compose exec -T web npm run lint`

4. Full cutover smoke
- `scripts/smoke_integrations_cutover.sh`

5. Architecture guard (standalone)
- `scripts/verify_integrations_architecture.sh`

## Exit criteria
- Smoke script returns `integrations cutover smoke: OK`.
- `GET /integrations/apps` and `GET /integrations/email/config` work.
- `GET /organizations/me/inbox` returns `404`.
- `settings/organization?tab=careers` still resolves (redirect path).
