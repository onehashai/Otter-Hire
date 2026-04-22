# Backend - AI Context

## Tech Stack

- FastAPI, Python 3.11+
- SQLAlchemy 2.0 (async), Alembic (migrations)
- PostgreSQL 16, Redis 7
- Temporal (async workflows)
- Pydantic (validation), JWT (auth)
- AWS SDK (S3, SES, SNS)

## Architecture

### API Structure (`app/api/v1`)

- **Internal** (`/v1/internal/*`): Authenticated routes (JWT required)
  - Auth, jobs, candidates, organizations, templates, automations, integrations, conversations, files, webhooks
  - Also includes current public-facing jobs/apply and inbound ingestion endpoints (mounted here at present)
- **Public** (`/v1/public/*`): Unauthenticated routes
  - Currently minimal/placeholder (health endpoint)

### Auth & Permissions

- **JWT**: Access + refresh token cookie auth; refresh JWT is hardcoded to 7 days, refresh cookie lifetime is config-driven (default 30 days)
- **Google OAuth**: Authorization code flow (CSRF state cookie), auto-links existing accounts by email, creates org on first sign-in; also supports linking Google to an existing email account via `_oauth_link_mode` cookie + shared `/auth/google/callback` URI
- **Forgot/reset password**: `POST /auth/forgot-password` (rate-limited, no enumeration) → email with signed token; `POST /auth/reset-password` → validates `password_reset_token_hash` + `password_reset_token_expires_at` on `users` table, updates password, invalidates all sessions
- **Roles**: owner, admin, recruiter, hiring_manager, interviewer, employee (org-level)
- **Middleware**: Request context middleware exists; auth enforcement is done through auth dependencies
- **Dependencies**: `get_current_user`, permission checks (`require_permission`), plus role/job checks where used

### Database (`app/models`)

- **Core**: User, Organization, OrgMembership
- **Jobs**: Job, Stage, JobTeamMember, JobCategory
- **Candidates**: Candidate, CandidateJobs (multi-job assignment), JobApplication
- **Content**: Note, Template, CandidateDocument
- **Integrations**: Integration, IntegrationCredential, InboundEmail
- **Automations**: Automation, AutomationExecution
- **Conversations**: Conversation, Message (email threads)
- **Interviews**: Interview, Feedback (interview scheduling + reviewer decisions)
- **Activities**: Activity (audit log)

### Services (`app/services`)

- **Resume parsing** (`resume/`): Extract text (PDF/DOCX/OCR), LLM-based extraction with structured outputs and confidence gating, Redis caching (30-day TTL), skills/certifications normalization; runs synchronously on candidate create and inbound email
- **Media validation** (`media.py`): File type and size validation for avatars and resume/document uploads (PDF, DOCX/DOC)
- **Document preview** (`candidates.py`): Inline preview endpoint serves PDF natively and converts DOCX/DOC → HTML via `mammoth`; filename extension takes priority over stored MIME type for detection
- **Email** (`email/`): Provider abstraction (`_factory.py`) selects ZeptoMail or SES based on credentials; handles transactional, conversation, and automation emails
- **Storage** (`storage.py`): Config-driven local/S3 selection
- **Automation** (`automation/`): Executor, action handlers, template rendering
- **AI** (`job_description_ai.py`): OpenAI-based job description generation
- **Integrations** (`integrations/`): Email integration (SMTP), Google OAuth, LinkedIn OAuth

### Temporal Workflows (`app/temporal`)

- **Resume parsing**: Workflow code exists but primary path is synchronous (`run_resume_pipeline()` called directly on candidate create and inbound email)
- **Email processing**: Triggered on inbound email (SES → SNS → webhook), creates candidate + application
- **Worker**: Separate process (`python -m app.temporal`) polls Temporal server

### Inbound Email Flow

1. SES receives email at `{jobId}@{INBOUND_EMAIL_DOMAIN}`
2. SES stores raw email in S3, publishes SNS notification
3. Inbound endpoint (`/v1/internal/inbound/s3-event`) validates SNS/S3 event and forwards for processing
4. Temporal workflow: parse email, extract attachments, detect resume, create candidate + application
5. Fallback: SES raw bridge polls S3 for missed emails (if SNS fails)

### Integrations

#### Email Integration

- **Outbound**: SMTP credentials stored encrypted (Fernet), per-job or org-level
- **Inbound**: SES → job-specific email address → candidate creation
- **Tracking**: SES configuration set → SNS → webhook (delivery, open, bounce events)

#### LinkedIn Integration

- **OAuth**: Authorization code flow, stores access token
- **Job distribution**: Partial/placeholder sync behavior (full posting flow not fully implemented)
- **Applicant ingestion**: Webhook receives LinkedIn applications (if feature enabled)

### Configuration (`app/core/config.py`)

- **Environment-based**: `IS_PRODUCTION` flag
- **Domain config**: `APP_DOMAIN`, `APP_SUBDOMAIN`, `JOBS_SUBDOMAIN`
- **Feature flags**: `FEATURE_EMAIL_INTEGRATION_MODULE`, `FEATURE_LINKEDIN_DISTRIBUTION`
- **Storage**: S3 bucket + region, local storage root
- **Email**: Mailtrap, ZeptoMail, SES config
- **Temporal**: Server URL, namespace

### Admin Panel (`app/admin`)

- SQLAdmin-based (dev only, disabled in prod)
- Direct DB access for debugging

### Middleware

- **CORS**: Configurable origins
- **Rate limiting**: slowapi (per-IP)
- **Request ID**: UUID7 attached to each request
- **Error handling**: Structured error responses with request ID

### Background Tasks

- **SES raw bridge**: Polls S3 for missed inbound emails (fallback for SNS)
- **Ignored email cleanup**: Deletes old ignored inbound emails (retention policy)

## Update Rules

- Update this file ONLY when changes affect system architecture, features, or behavior
- Do NOT update for minor changes (UI tweaks, bug fixes, refactoring without behavior change)
- Prefer modifying specific sections instead of rewriting entire file
- Keep summaries concise and high-signal
- Avoid unnecessary updates to maintain stability
