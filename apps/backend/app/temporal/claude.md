# Temporal Subsystem

## Overview

This subsystem provides asynchronous workflow orchestration using Temporal. It handles long-running, reliable background tasks that require retry logic, state persistence, and observability.

Why it exists:
- Decouple heavy processing from API request/response cycle
- Provide reliable retry and failure handling for external integrations
- Enable observability and debugging of async workflows
- Handle S3/SES inbound email processing pipeline
- Process resume parsing with AI services

How it fits:
- FastAPI enqueues workflows via Temporal client
- Temporal worker executes workflows and activities
- Workflows interact with DB, S3, external APIs
- Results published back to FastAPI or stored in DB

## Architecture

### Key Components

- `client.py`: Temporal client singleton (connection to Temporal server)
- `worker.py`: Temporal worker that executes workflows and activities
- `email/`: Email processing workflows
  - `workflow.py`: Inbound and outbound email workflows
  - `activities.py`: Activity implementations (S3 fetch, DB write, SES send)
  - `queue.py`: Queue helpers for enqueuing workflows
  - `types.py`: Input/output type definitions
- `resume_parsing/`: Resume parsing workflows
  - `workflow.py`: Resume parsing workflow
  - `activities.py`: Activity implementations (AI parsing, DB update)
  - `queue.py`: Queue helpers
  - `types.py`: Type definitions

### Workflow vs Activity

**Workflow**:
- Orchestrates activities (defines order, retry, timeout)
- Durable (survives worker restarts)
- Deterministic (no side effects, no random, no direct I/O)
- Logged and observable in Temporal UI

**Activity**:
- Performs actual work (DB queries, API calls, file I/O)
- Non-deterministic (can have side effects)
- Retryable with configurable policies
- Isolated failure (one activity failure doesn't crash workflow)

### Temporal Queues

- `email-inbound-queue`: Inbound email processing
- `email-outbound-queue`: Outbound email sending
- `resume-parsing-queue`: Resume parsing with AI

Each queue has dedicated worker listening for tasks.

## Key Concepts

### Inbound Email Workflow

**Trigger**: SES receives email → S3 stores raw email → SNS notification → FastAPI webhook → Temporal workflow

**Flow**:
1. `InboundEmailWorkflow` receives S3 bucket + key
2. Activity `process_s3_inbound_email_activity`:
   - Fetches raw email from S3
   - Parses email (from, to, subject, body, attachments)
   - Validates inbox address and secret
   - Creates/updates candidate record
   - Creates message record in conversation
   - Stores attachments in S3
3. Activity `publish_update_activity`:
   - Publishes event for real-time updates (future: WebSocket/SSE)
4. Workflow completes with result

**Retry Policy**:
- Initial interval: 2 seconds
- Maximum attempts: 3
- Timeout: 5 minutes per activity

### Outbound Email Workflow

**Trigger**: User sends message from UI → FastAPI creates message record → Temporal workflow

**Flow**:
1. `OutboundEmailWorkflow` receives message details
2. Activity `send_outbound_email_activity`:
   - Loads message from DB
   - Renders email template
   - Sends via SES with reply-to tracking
   - Updates message status to `sent`
3. On success: Workflow completes
4. On failure: Activity retries, then marks message as `failed`

**Retry Policy**:
- Initial interval: 5 seconds
- Backoff: 2x (5s, 10s, 20s)
- Maximum interval: 5 minutes
- Maximum attempts: 3

### Resume Parsing Workflow

**Note**: Resume parsing now runs synchronously via `run_resume_pipeline()` called directly in the candidates endpoint (on manual upload) and in the inbound email handler. The Temporal workflow code exists but is not the primary trigger path.

**Flow** (synchronous pipeline):
1. Candidate created with resume document
2. `run_resume_pipeline()` called directly:
   - Fetches resume from S3
   - Calls LLM service with structured outputs and confidence gating
   - Normalizes skills and certifications
   - Caches result in Redis (30-day TTL)
   - Updates candidate record with extracted data (`parsed_resume_profile`)

**Retry Policy** (Temporal workflow, if used):
- Initial interval: 2 seconds
- Maximum attempts: 3
- Timeout: 3 minutes per activity

### Client Usage from FastAPI

To enqueue a workflow from FastAPI:

```python
from app.temporal.client import get_temporal_client
from app.temporal.email.queue import enqueue_inbound_email

client = await get_temporal_client()
await enqueue_inbound_email(
    client=client,
    bucket="email-bucket",
    key="emails/abc123.eml",
)
```

### Worker Startup

Worker runs as separate process:
```bash
python -m app.temporal
```

Worker registers workflows and activities, then polls Temporal server for tasks.

## Data / Flow Explanation

### Inbound Email End-to-End

1. **Email arrives**: recruiter@company.com sends to jobs@smartats.in
2. **SES receives**: Email stored in S3 bucket
3. **SNS notification**: Webhook hits `/v1/internal/webhooks/inbound-email`
4. **Webhook handler**: Validates signature, enqueues Temporal workflow
5. **Workflow starts**: `InboundEmailWorkflow` executes
6. **Activity 1**: Fetch email from S3, parse, validate inbox
7. **Activity 2**: Create candidate + message in DB
8. **Activity 3**: Publish update event
9. **Workflow completes**: Result logged in Temporal UI

### Outbound Email End-to-End

1. **User sends message**: UI calls `/conversations/{id}/messages`
2. **API creates message**: Status = `pending`
3. **API enqueues workflow**: `OutboundEmailWorkflow`
4. **Workflow starts**: Loads message from DB
5. **Activity**: Sends email via platform provider (ZeptoMail or SES)
6. **Success**: Message status → `sent`
7. **Failure**: Retries 3x, then status → `failed`

### Resume Parsing End-to-End

1. **Candidate uploads resume**: UI calls `/candidates/{id}/documents`
2. **API stores file**: S3 upload, document record created
3. **API enqueues workflow**: `ResumeParsingWorkflow`
4. **Workflow starts**: Loads document from DB
5. **Activity 1**: Fetch resume from S3, call AI service
6. **Activity 2**: Update candidate with parsed data
7. **Workflow completes**: Candidate.parsed_resume populated

## Important Constraints / Design Decisions

### Workflow Determinism

- Workflows MUST be deterministic (same input → same output)
- No direct DB queries, API calls, or random in workflow code
- All side effects MUST be in activities
- Use `workflow.unsafe.imports_passed_through()` for type imports

### Activity Idempotency

- Activities should be idempotent (safe to retry)
- Check if work already done before performing action
- Use DB transactions to ensure atomicity

### Client Singleton

- Temporal client is singleton (one connection per process)
- Connection retries with exponential backoff (1s → 30s)
- Shared across all FastAPI workers (async-safe)

### Worker Isolation

- Worker runs in separate process from FastAPI
- Worker has own DB connection pool
- Worker can be scaled independently (multiple workers per queue)

### Queue Naming

- Queue names are hardcoded in workflow definitions
- Must match between enqueue call and worker registration
- No dynamic queue routing (by design)

### Timeout Strategy

- Activities have `start_to_close_timeout` (max execution time)
- Workflows have implicit timeout (can be set per workflow)
- Timeouts prevent stuck workflows from consuming resources

### Error Handling

- Activity failures trigger retries (per retry policy)
- After max retries, workflow can catch `ActivityError` and handle gracefully
- Workflow failures are logged in Temporal UI for debugging

### Logging

- Workflows use `workflow.logger` (replayed during recovery)
- Activities use standard Python logging
- All logs visible in Temporal UI

## Extension Guide

### Adding a New Workflow

1. Create workflow module: `app/temporal/<domain>/`
2. Define workflow class:
   ```python
   @workflow.defn
   class MyWorkflow:
       @workflow.run
       async def run(self, input_data: MyInput) -> dict:
           result = await workflow.execute_activity(
               "my_activity",
               input_data,
               start_to_close_timeout=timedelta(minutes=5),
               retry_policy=RetryPolicy(maximum_attempts=3),
           )
           return result
   ```
3. Define activity:
   ```python
   @activity.defn
   async def my_activity(input_data: MyInput) -> dict:
       # Implementation
       return {"status": "success"}
   ```
4. Register in `worker.py`:
   ```python
   worker = Worker(
       client,
       task_queue="my-queue",
       workflows=[MyWorkflow],
       activities=[my_activity],
   )
   ```
5. Create queue helper in `queue.py`:
   ```python
   async def enqueue_my_workflow(client: Client, input_data: MyInput):
       await client.start_workflow(
           MyWorkflow.run,
           input_data,
           id=f"my-workflow-{uuid4()}",
           task_queue="my-queue",
       )
   ```

### Adding a New Activity to Existing Workflow

1. Define activity function in `activities.py`
2. Add `@activity.defn` decorator
3. Register activity in `worker.py`
4. Call activity from workflow:
   ```python
   result = await workflow.execute_activity(
       "new_activity",
       input_data,
       start_to_close_timeout=timedelta(minutes=2),
   )
   ```

### Modifying Workflow Logic

**CRITICAL**: Workflows must remain backward compatible!

- Temporal replays workflows from history during recovery
- Changing workflow logic can break in-flight workflows
- Use versioning for breaking changes:
  ```python
  version = workflow.patched("my-change-v2")
  if version:
      # New logic
  else:
      # Old logic
  ```

### Scaling Workers

To scale worker capacity:
1. Run multiple worker processes (same queue)
2. Temporal load-balances tasks across workers
3. Each worker should have own DB connection pool
4. Monitor worker health in Temporal UI

### Local Development

1. Start Temporal server:
   ```bash
   docker compose up -d temporal
   ```
2. Access Temporal UI: `http://localhost:8081`
3. Start worker:
   ```bash
   cd apps/backend
   python -m app.temporal
   ```
4. Enqueue workflow from FastAPI or test script

### What to Avoid

- Do NOT add non-deterministic code in workflows (random, datetime.now, DB queries)
- Do NOT change workflow logic without versioning (breaks replay)
- Do NOT use long timeouts without good reason (blocks resources)
- Do NOT skip retry policies (activities should be resilient)
- Do NOT share state between activities (use workflow state or DB)
- Do NOT run worker in same process as FastAPI (separate concerns)

## Update Rules

- Update this file ONLY when:
  - New workflow or activity is added
  - Queue structure or naming changes
  - Retry policies or timeout strategies change
  - Worker architecture or scaling approach changes
  - Integration with FastAPI changes

- Do NOT update for:
  - Minor activity implementation changes
  - Bug fixes in activity logic
  - Logging improvements
  - Temporal version upgrades (unless breaking)

- If changes affect global architecture:
  - Also update root /claude.md

- If changes affect only this subsystem:
  - Update ONLY this file

- Always MODIFY existing sections instead of rewriting entire file
