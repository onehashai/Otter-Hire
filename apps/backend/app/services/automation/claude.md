# Automation Subsystem

## Overview

This subsystem provides event-driven automation capabilities for Otter. It allows users to configure triggers (e.g., candidate applied, moved to stage) and actions (e.g., send email, move candidate) that execute automatically.

Why it exists:
- Reduce manual repetitive tasks for recruiters
- Ensure consistent candidate communication
- Enable workflow customization per org/job
- Provide audit trail for automated actions

How it fits:
- Triggered by API endpoints after candidate/job events
- Reads automation rules from `automations` table
- Executes actions via action handlers
- Logs execution history in `automation_executions` table

## Architecture

### Key Components

- `executor.py`: Main automation engine that processes triggers
- `actions.py`: Action handlers (send email, move candidate, etc.)
- `template_renderer.py`: Jinja2 template rendering for dynamic content
- `logger.py`: Execution logging and statistics tracking

### Execution Flow

1. **Event occurs**: Candidate applied, moved, hired, rejected, etc.
2. **Trigger invoked**: API calls `execute_automations_for_trigger()`
3. **Query matching automations**: Filter by org, trigger, scope, and config
4. **Execute actions**: For each automation, run all configured actions
5. **Log results**: Record success/failure in `automation_executions`
6. **Update stats**: Increment execution counters on automation

## Key Concepts

### Trigger Types

Automations are triggered by specific events:
- `candidate_applied`: New candidate added to job
- `candidate_job_assigned`: Candidate assigned to job
- `candidate_moved`: Candidate moved to different stage
- `candidate_hired`: Candidate marked as hired
- `candidate_rejected`: Candidate marked as rejected
- `candidate_email_received`: Inbound email received from candidate

### Scope Filtering

Automations can be scoped:
- `all`: Applies to all jobs in org
- `specific_job`: Applies only to specified `job_id`

When event has `job_id`, both `all` and matching `specific_job` automations run.

### Trigger Config Matching

Some triggers require additional config matching:
- `candidate_moved`: Can specify target `stage` name
  - If stage specified, automation only fires when candidate moves to that stage
  - If no stage specified, fires on any stage move

### Action Types

Available actions:
- `send_email`: Send templated email to candidate
- `move_to_stage`: Move candidate to specified stage
- `add_tag`: Add tag to candidate
- `assign_to_user`: Assign candidate to team member

Each action has a `config` dict with action-specific parameters.

### Template Rendering

Email templates support Jinja2 syntax with context variables:
- `candidate`: Candidate object (name, email, etc.)
- `job`: Job object (title, description, etc.)
- `organization`: Organization object (name, website, etc.)
- `stage`: Stage object (name, position) - if applicable

Example template:
```
Hi {{ candidate.name }},

Thank you for applying to {{ job.title }} at {{ organization.name }}.

Best regards,
{{ organization.name }} Team
```

### Idempotency Protection

For noisy triggers (`candidate_applied`, `candidate_job_assigned`):
- Checks for duplicate execution within 2-minute window
- Skips if same automation + trigger + candidate + job already succeeded
- Prevents duplicate emails from race conditions

## Data / Flow Explanation

### End-to-End Flow

1. **Candidate applies to job**
2. API creates candidate record
3. API calls `execute_automations_for_trigger("candidate_applied", ...)`
4. Executor queries active automations:
   - Match org_id
   - Match trigger_key = "candidate_applied"
   - Match scope (all or specific_job)
5. For each matching automation:
   - Check trigger_config (e.g., stage filter)
   - Execute each action in sequence
   - Log success/failure per action
6. Commit execution log to DB
7. Update automation stats (execution_count, last_executed_at)

### Action Execution

Each action handler in `actions.py`:
1. Receives action config + context (candidate_id, org_id, job_id)
2. Loads required data from DB (candidate, job, stage, etc.)
3. Performs action (send email, update DB, etc.)
4. Returns `(success: bool, message: str)`

If any action fails:
- Remaining actions still execute (no short-circuit)
- Overall execution marked as partial failure
- Error message logged for debugging

### Template Rendering

`template_renderer.py` provides:
- `render_template(template_str, context)`: Renders Jinja2 template
- Context building from DB models
- Safe error handling (returns error message if template invalid)

## Important Constraints / Design Decisions

### Execution Guarantees

- Automations execute asynchronously (don't block main API flow)
- Failures are logged but don't raise exceptions to caller
- No transaction rollback if automation fails (candidate still created)
- Actions execute in order but independently (one failure doesn't stop others)

### Scope Resolution

- If event has no `job_id`, only `scope=all` automations run
- If event has `job_id`, both `scope=all` and matching `scope=specific_job` run
- This allows org-wide defaults + job-specific overrides

### Trigger Config Semantics

- Empty trigger_config means "match all events of this type"
- Non-empty trigger_config adds additional filtering
- Currently only `candidate_moved` uses trigger_config (stage filter)

### Idempotency

- Only applied to high-frequency triggers (applied, job_assigned)
- 2-minute window is hardcoded (not configurable)
- Based on success status only (failed executions can retry)
- Checks exact match: automation + trigger + candidate + job

### Template Safety

- Templates are sandboxed (no file system access, no imports)
- Invalid templates return error message instead of crashing
- Missing variables render as empty string (Jinja2 default)

### Logging

- Every automation execution creates `AutomationExecution` record
- Stores trigger event, candidate_id, job_id, status, message
- Stats updated on automation: execution_count, last_executed_at
- No automatic cleanup (executions accumulate for audit)

## Extension Guide

### Adding a New Trigger

1. Define trigger key constant (e.g., `"candidate_interview_scheduled"`)
2. Add trigger invocation in relevant API endpoint:
   ```python
   await execute_automations_for_trigger(
       db=db,
       trigger_key="candidate_interview_scheduled",
       org_id=org_id,
       candidate_id=candidate_id,
       job_id=job_id,
       metadata={"interview_date": "2024-01-15"},
   )
   ```
3. If trigger needs config filtering, add logic to `_matches_trigger_config()`
4. Update frontend automation builder to support new trigger

### Adding a New Action

1. Add action handler function in `actions.py`:
   ```python
   async def execute_my_action(
       db: AsyncSession,
       config: dict,
       candidate_id: UUID,
       org_id: UUID,
       job_id: UUID | None,
       metadata: dict | None,
   ) -> tuple[bool, str]:
       # Implementation
       return True, "Action completed"
   ```
2. Register action in `execute_action()` dispatcher:
   ```python
   elif action_type == "my_action":
       return await execute_my_action(...)
   ```
3. Update frontend automation builder to support new action

### Adding Template Variables

1. Update context building in `template_renderer.py`
2. Load additional data from DB as needed
3. Add to context dict passed to Jinja2
4. Document available variables for users

### Extending Trigger Config

To add config filtering for existing trigger:
1. Update `_matches_trigger_config()` in `executor.py`
2. Add conditional logic based on `trigger_config` fields
3. Update frontend to allow users to configure new fields

### What to Avoid

- Do NOT raise exceptions from action handlers (return failure tuple instead)
- Do NOT modify automation status from executor (only log executions)
- Do NOT skip logging even on failure (audit trail is critical)
- Do NOT add blocking operations in action handlers (keep fast)
- Do NOT allow user-provided code execution in templates (security risk)
- Do NOT change idempotency window without considering race conditions

## Update Rules

- Update this file ONLY when:
  - New trigger type is added
  - New action type is added
  - Execution flow or scope logic changes
  - Idempotency or logging behavior changes
  - Template rendering capabilities change

- Do NOT update for:
  - Bug fixes in specific action handlers
  - Template syntax improvements
  - Minor refactoring of executor logic
  - UI changes in automation builder

- If changes affect global architecture:
  - Also update root /claude.md

- If changes affect only this subsystem:
  - Update ONLY this file

- Always MODIFY existing sections instead of rewriting entire file
