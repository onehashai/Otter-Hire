# ADR 0001: Integrations Modular Architecture (Phase 0)

## Status
Accepted (Phase-0 baseline only; no runtime cutover)

## Context
The current Careers Inbox capability is implemented across multiple generic folders. This makes ownership and extension for future app-store integrations unclear.

## Decision
Adopt an integration-first modular architecture:

- Backend target namespace: `app/integrations/app_store/<integration_name>/...`
- Frontend target namespace: `src/features/integrations/app-store/<integration-name>/...`
- Keep shared foundations (`core`, `db`, auth, middleware, common ui) centralized.
- Keep existing endpoints and behavior via compatibility adapters during migration.

## Feature Flags (Phase-0)
The following flags are introduced and default to `false` to avoid behavior changes:

- Backend
  - `FEATURE_INTEGRATIONS_APP_STORE_UI`
  - `FEATURE_EMAIL_INTEGRATION_MODULE`
  - `FEATURE_LEGACY_ORG_INBOX_ROUTE_REDIRECT`
- Frontend
  - `NEXT_PUBLIC_FEATURE_INTEGRATIONS_APP_STORE_UI`
  - `NEXT_PUBLIC_FEATURE_LEGACY_ORG_INBOX_ROUTE_REDIRECT`

## Non-Goals in Phase-0
- No route cutover
- No database schema migration for integrations
- No UI relocation yet

## Risks
- Refactor churn can break existing flows without regression baseline.

## Mitigation
- Freeze current behavior with a repeatable regression checklist before any module moves.
- Keep backward-compatible adapters through migration.
