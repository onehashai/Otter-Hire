# Integrations Subsystem

## Overview

This subsystem manages third-party integrations for Otter. It provides a pluggable architecture for connecting external services like email providers (SES) and job portals (LinkedIn).

Why it exists:
- Centralize integration logic and credential management
- Enable org-level and job-level integration scopes
- Support OAuth flows and webhook ingestion
- Provide a registry pattern for adding new integrations

How it fits:
- Called by API endpoints in `app/api/v1/internal/endpoints/integrations.py`
- Stores credentials in `integration_credentials` table
- Triggers Temporal workflows for async processing (email inbound)
- Interacts with external APIs (LinkedIn OAuth, SES)

## Architecture

### Key Components

- `app_store/registry.py`: Central registry of all integrations
- `app_store/email_integration/`: Email (SES) integration module
  - `service.py`: Org-level inbox configuration and verification
  - `credential_store.py`: Credential CRUD and caching
  - `job_service.py`: Job-level email routing
  - `outbound_service.py`: Outbound email sending
  - `ses_bridge.py`: SES inbound webhook handler
- `linkedin/service.py`: LinkedIn OAuth and job distribution

### Integration Flow

1. **Registration**: Each integration implements `AppStoreIntegration` interface
2. **Discovery**: Frontend calls `/integrations/apps` → registry returns available apps
3. **Installation**: User connects integration → credentials stored in DB
4. **Usage**: Integration services are invoked by API or workflows

## Key Concepts

### Registry Pattern

All integrations are registered in `INTEGRATIONS` tuple in `registry.py`. Each integration must implement:
- `list_apps()`: Return available apps for this integration
- `list_installed()`: Return installed apps for an org

To add a new integration:
1. Create module under `app_store/` or top-level (e.g., `slack/`)
2. Implement `AppStoreIntegration` interface
3. Add to `INTEGRATIONS` tuple in `registry.py`

### Credential Scopes

Credentials can be scoped at two levels:
- **Org-level**: `job_id = NULL` (e.g., LinkedIn, org inbox)
- **Job-level**: `job_id = <uuid>` (e.g., job-specific email routing)

### Email Integration Architecture

Email integration has two flows:

**Inbound (SES → S3 → SNS → Temporal)**:
1. SES receives email at org inbox address
2. Email stored in S3, SNS notification sent
3. Webhook hits `/v1/internal/webhooks/inbound-email`
4. `ses_bridge.py` validates signature and queues Temporal workflow
5. Temporal workflow processes email and creates candidate/message

**Outbound (FastAPI → Temporal → platform provider)**:
1. User sends message from UI
2. API enqueues `OutboundEmailWorkflow` via Temporal
3. Platform provider (ZeptoMail or SES) sends email with reply-to tracking

### LinkedIn Integration Architecture

**OAuth Flow**:
1. User clicks "Connect LinkedIn" → API generates OAuth URL with state
2. User authorizes → LinkedIn redirects to callback
3. Callback exchanges code for access token
4. Token stored in `integration_credentials` with `status=pending`
5. User selects LinkedIn company page → `status=active`

**Job Distribution**:
1. User publishes job with LinkedIn enabled
2. `sync_job_distribution_to_linkedin()` called
3. Job metadata synced (currently placeholder for real API)
4. `linkedin_external_job_id` and `linkedin_sync_status` updated

**Applicant Ingestion**:
1. LinkedIn webhook sends applicant data
2. `ingest_linkedin_applicant_event()` validates signature
3. Candidate created and attached to job's first stage
4. Resume uploaded to S3 if provided

## Data / Flow Explanation

### Email Credential Lifecycle

1. **Create**: User enters inbox address → `upsert_email_config()`
2. **Verify**: System generates secret → user adds to email provider
3. **Activate**: Verification email received → `verify_complete()` → `status=active`
4. **Rotate**: User rotates secret → `rotate_secret()` → new secret generated

### LinkedIn Credential Lifecycle

1. **Connect**: OAuth flow → token stored with `status=pending`
2. **Setup**: User selects company page → `complete_linkedin_setup()` → `status=active`
3. **Disconnect**: User removes integration → credential deleted

## Important Constraints / Design Decisions

### Email Integration

- Inbox addresses must be globally unique across all orgs
- Verification status is cached in-memory (not persisted) for UX responsiveness
- Verification URLs are whitelisted (Google, Outlook only) for security
- Secret rotation invalidates previous verification state
- Job-level email routing requires org-level inbox to be active first

### LinkedIn Integration

- OAuth scopes include `w_organization_social` for job posting
- Only users with `ADMINISTRATOR` role on LinkedIn org can connect
- Job distribution is currently a placeholder (no real LinkedIn API call)
- Webhook signature verification uses `linkedin_webhook_secret` or falls back to `linkedin_client_secret`
- Applicants are always added to job's first stage

### General

- All integrations use `IntegrationCredential` model with JSONB `config` field
- Credentials are org-scoped (multi-tenancy enforced)
- Integration status: `not_installed`, `pending`, `active`, `failed`
- Encrypted credentials stored in `encrypted_credentials` column (access tokens, secrets)

## Extension Guide

### Adding a New Integration

1. Create module: `app/integrations/<integration_name>/`
2. Implement service with core methods:
   - OAuth flow (if applicable)
   - Credential management
   - Core integration logic (e.g., post job, sync data)
3. Create integration class in `app_store/registry.py`:
   ```python
   @dataclass(frozen=True)
   class MyIntegrationModule(AppStoreIntegration):
       app_id: str = "my_integration"
       slug: str = "my-integration"
       name: str = "My Integration"
       category: str = "category"
       
       async def list_apps(self, db, owner):
           # Implementation
       
       async def list_installed(self, db, owner):
           # Implementation
   ```
4. Add to `INTEGRATIONS` tuple
5. Create API endpoints in `app/api/v1/internal/endpoints/integrations.py`
6. Add frontend UI in `apps/web/src/features/integrations/`

### Extending Email Integration

To add job-level email routing:
1. Use `job_service.py` methods
2. Ensure org-level inbox is active first
3. Store job-specific config in credential with `job_id` set

To add new email providers (beyond SES):
1. Implement provider-specific webhook handler in `ses_bridge.py` or new module
2. Update `provider` field in credential config
3. Add provider-specific verification logic

### Extending LinkedIn Integration

To add real job posting:
1. Update `sync_job_distribution_to_linkedin()` in `linkedin/service.py`
2. Call LinkedIn Jobs API with org credentials
3. Store real `external_job_id` from LinkedIn response

To add more OAuth scopes:
1. Update `LINKEDIN_SCOPES` in `linkedin/service.py`
2. Request re-authorization from users

### What to Avoid

- Do NOT store plaintext secrets in `config` field (use `encrypted_credentials`)
- Do NOT skip signature verification for webhooks in production
- Do NOT allow duplicate inbox addresses across orgs
- Do NOT modify credential status without proper state transitions
- Do NOT bypass org-level checks for job-level integrations

## Update Rules

- Update this file ONLY when:
  - New integration is added to registry
  - Integration architecture or credential lifecycle changes
  - New OAuth provider or webhook flow is added
  - Core patterns (registry, scopes, verification) are modified

- Do NOT update for:
  - Minor bug fixes in integration logic
  - UI changes in integration settings
  - Credential field additions that don't change flow

- If changes affect global architecture:
  - Also update root /claude.md

- If changes affect only this subsystem:
  - Update ONLY this file

- Always MODIFY existing sections instead of rewriting entire file
