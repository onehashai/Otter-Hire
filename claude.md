# Otter - AI Context

## Architecture Overview

**Monorepo-based Applicant Tracking System** with multi-tenant support, async workflows, and subdomain-based routing.

### Stack

- **Frontend**: Next.js 16.2.3 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: FastAPI, async SQLAlchemy, Alembic migrations
- **Database**: PostgreSQL 16
- **Async Workflows**: Temporal (resume parsing, email processing)
- **Cache/Queue**: Redis
- **Storage**: Config-driven (local filesystem default, AWS S3 when enabled)
- **Email**: ZeptoMail or AWS SES for all outbound (credential-based selection); AWS SES for inbound

### Core Modules

#### Frontend (`apps/web`)

- **Subdomain routing**: `app.domain.com` (authenticated app), `jobs.domain.com` (public careers)
- **Auth**: JWT-based (access + refresh tokens), cookie-based session; Google OAuth supported
- **Pages**: Jobs, Candidates, Automations, Templates, Settings, Reports
- **Features**: Email integration, LinkedIn integration, AI job descriptions, automation builder

#### Backend (`apps/backend`)

- **API**: FastAPI with `/v1/internal` (authenticated, plus current public jobs/apply + inbound endpoints) and `/v1/public` (currently minimal/health)
- **Auth**: JWT + refresh tokens, role/permission model (`owner`, `admin`, `recruiter`, `hiring_manager`, `interviewer`, `employee`)
- **Services**: Resume parsing, email processing, automation execution, storage, AI job descriptions
- **Integrations**: Email (SMTP/SES), Google OAuth, LinkedIn OAuth, inbound email via SES/SNS
- **Async**: Temporal workflows for resume parsing and email processing

#### Shared (`packages/ui`)

- Reusable UI components (shadcn/ui-based)

### Key Design Decisions

1. **Multi-tenancy**: Organization-scoped data with role-based access control
2. **Subdomain routing**: Separate public careers site from authenticated app
3. **Async workflows**: Temporal handles long-running tasks (resume parsing, email processing)
4. **Inbound email**: SES → SNS → webhook → Temporal workflow → candidate creation
5. **Storage**: S3 with environment-based prefixes (`ats-production`, `ats-staging`)
6. **Migrations**: Alembic for schema versioning
7. **Monorepo**: Shared UI components, independent deployment of web/backend/worker

### Frontend ↔ Backend Interaction

- **Auth**: Frontend stores JWT in httpOnly cookies, backend validates via middleware
- **API calls**: Frontend uses typed API client (`src/api/*`), backend exposes OpenAPI schema
- **Session**: `/v1/internal/me` returns current user + org context
- **File uploads**: Direct to backend, backend handles S3 upload
- **Real-time**: Backend uses Temporal for async workflows; frontend uses WebSocket in the conversations/messages view, polling elsewhere

### Deployment

- **Local**: Docker Compose (all services)
- **Staging/Prod**: AWS ECS (web, backend, worker), RDS (Postgres), ElastiCache (Redis), Temporal Cloud
- **CI/CD**: GitHub Actions (CI on PR; deploy staging on push/merge to `develop` and manual `workflow_dispatch`; deploy prod on push/merge to `main` and manual `workflow_dispatch`; web/backend use ECS CodeDeploy blue/green, worker remains ECS rolling)

## Update Rules

- Update this file ONLY when changes affect system architecture, features, or behavior
- Do NOT update for minor changes (UI tweaks, bug fixes, refactoring without behavior change)
- Prefer modifying specific sections instead of rewriting entire file
- Keep summaries concise and high-signal
- Avoid unnecessary updates to maintain stability
