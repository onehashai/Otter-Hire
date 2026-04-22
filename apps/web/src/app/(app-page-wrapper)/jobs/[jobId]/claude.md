# Jobs [jobId] Route

## Overview

This is the most complex frontend route in the application, handling both job setup/configuration and the job workspace (candidate pipeline management). It uses nested layouts and dynamic routing to provide a multi-step job creation wizard and a full-featured candidate management interface.

Why it exists:

- Provide guided job creation flow with validation
- Enable job editing with auto-save and unsaved changes protection
- Support job workspace for managing candidates through hiring stages
- Share job context across all sub-pages

How it fits:

- Mounted under `(app-page-wrapper)` layout (authenticated users only)
- Uses dynamic route parameter `[jobId]`
- Provides context to all child routes via `context.tsx`
- Conditionally renders setup wizard or workspace based on route

## Architecture

### Key Components

- `layout.tsx`: Root layout that conditionally renders setup wizard or workspace
- `context.tsx`: Job state management with React Context (JobSetupProvider)
- `page.tsx`: Job workspace root (candidate pipeline view)
- `constants.ts`: Type definitions and setup step configuration
- Sub-routes:
  - `info/`, `description/`, `application/`, `details/`, `stages/`, `team/`, `integration/`: Setup wizard steps (distribution route does not exist)
  - `stage/[stageId]/`: Stage-specific candidate view
  - `candidates/[candidateId]/`: Candidate detail view
  - `stage/[stageId]/candidates/[candidateId]/`: Candidate detail within stage context

### Layout Hierarchy

```
layout.tsx (JobBranchLayout)
├─ Setup Mode (when on /jobs/[jobId]/{info|description|...})
│  └─ JobSetupProvider (context.tsx)
│     └─ SetupLayoutInner
│        ├─ Navigation tabs
│        ├─ Progress indicator (mobile)
│        ├─ Summary sidebar (desktop)
│        └─ {children} (setup step pages)
│
└─ Workspace Mode (when on /jobs/[jobId] or /jobs/[jobId]/stage/...)
   └─ {children} (workspace pages)
```

### Route Detection Logic

`JobBranchLayout` determines mode based on URL segments:

- **Workspace Mode**: `/jobs/[jobId]`, `/jobs/[jobId]/stage/[stageId]`, `/jobs/[jobId]/candidates/[candidateId]`
- **Setup Mode**: All other routes under `/jobs/[jobId]/*`

## Key Concepts

### Job Context (context.tsx)

Provides centralized state management for job data:

- Job fields (title, description, salary, etc.)
- Hiring stages (pipeline configuration)
- Team members (collaborators)
- UI state (loading, saving, unsaved changes)
- Actions (save, publish, unpublish, etc.)

Context is scoped to setup mode only (not available in workspace mode).

### Auto-Save

- Debounced save (1.5 second delay after last change)
- Triggered on any field change that marks state as unsaved
- Skips save if job has no ID or title is empty
- Queues pending saves if save already in progress

### Unsaved Changes Protection

- Tracks `hasUnsavedChanges` flag on any field modification
- Intercepts browser navigation (beforeunload event)
- Intercepts Next.js navigation (useNavigationGuard hook)
- Shows confirmation dialog before leaving
- Options: Save & Navigate, Discard, Cancel

### Setup Wizard Steps

Defined in `constants.ts` as `SETUP_SECTIONS`:

1. **Info**: Basic job details (title, category, employment type, location)
2. **Description**: Job description with AI assistant
3. **Application**: Application form configuration (resume, cover letter, screening questions)
4. **Details**: Salary, openings, LinkedIn distribution
5. **Stages**: Hiring pipeline stages
6. **Team**: Team member roles (hiring manager, recruiter, interviewer)
7. **Integration**: Email integration settings

### Validation

Validation logic in `lib/validations/setupValidation.ts`:

- **Basic Info**: Title (1-100 chars), location (required for hybrid/onsite)
- **Salary**: Valid ranges for fixed/range salary types
- Validation runs on:
  - Next button click (blocks navigation if invalid)
  - Save button click (shows error toast)
  - Publish button click (navigates to first invalid section)

### Stage Normalization

Hiring stages are normalized to ensure required stages:

- **Applied**: Always first (auto-added if missing)
- **Custom stages**: User-defined stages in middle
- **Hired**: Always second-to-last (auto-added if missing)
- **Rejected**: Always last (auto-added if missing)

### Publish/Unpublish Flow

**Publish**:

1. Validate all required fields
2. Save current changes (force save with relations)
3. Call `apiPublishJob()` → sets `status=open`
4. Update context with new job state
5. Show success toast

**Unpublish**:

1. Call `apiUnpublishJob()` → sets `status=draft`
2. Update context with new job state
3. Show success toast

### AI Assistant

Integrated AI writing assistant for job descriptions:

- Actions: Generate full, improve tone, shorten, expand, add sections
- Calls `/jobs/{id}/ai-description` API endpoint
- Updates description in context on success
- Available via floating button or sheet

## Data / Flow Explanation

### Job Creation Flow

1. User clicks "Create Job" → navigates to `/jobs/new`
2. API creates draft job → returns job ID
3. Redirects to `/jobs/[jobId]/info`
4. User fills in basic info → auto-save triggers
5. User navigates through steps → validation on each step
6. User clicks "Publish" → validation + publish API call
7. Job status changes to `open` → visible on job board

### Job Editing Flow

1. User clicks job from list → navigates to `/jobs/[jobId]`
2. Context loads job data via `getJobById()`
3. User edits fields → `hasUnsavedChanges` set to true
4. Auto-save triggers after 1.5s → saves to API
5. User navigates away → unsaved changes dialog (if any)

### Stage Management Flow

1. User adds stage → `addHiringStage()` → local state update
2. Auto-save triggers → `buildPayload()` includes stages
3. Stages normalized (Applied, custom, Hired, Rejected)
4. API updates stages with positions
5. Context refreshes with normalized stages

### Team Member Management Flow

1. User adds team member → `addTeamMember()` → local state update
2. Auto-save triggers → `buildPayload()` includes team members
3. API creates `job_team_members` records
4. Context refreshes with team member data

## Important Constraints / Design Decisions

### Context Scope

- Context is ONLY available in setup mode
- Workspace mode does NOT use context (loads data independently)
- This prevents context bloat and improves performance

### Auto-Save Strategy

- Debounced to avoid excessive API calls
- Skips save if no job ID (new job not yet created)
- Skips save if title is empty (invalid state)
- Queues pending saves to avoid race conditions

### Validation Timing

- Validation is lazy (only on user action, not on field change)
- `basicInfoAttemptedNext` flag tracks if user tried to proceed
- Validation errors shown only after user attempts action
- This avoids annoying users with premature error messages

### Stage Normalization

- Applied, Hired, Rejected are ALWAYS present
- User cannot delete these required stages
- Normalization happens on every save (client + server)
- Ensures consistent pipeline structure across all jobs

### Unsaved Changes Detection

- Tracks changes at field level (not deep object comparison)
- Special handling for JSONB fields (stable stringify for comparison)
- Dirty flags for relations (stages, team members) to optimize payload
- Browser navigation blocked via beforeunload event

### Mobile vs Desktop

- Mobile: Stepper UI with progress bar, bottom sheet for summary
- Desktop: Tab navigation, sticky sidebar for summary
- Responsive layout switches at `lg` breakpoint (1024px)

### Route Branching

- Layout uses URL pattern matching to determine mode
- Workspace mode: Minimal layout (no setup UI)
- Setup mode: Full wizard UI with navigation
- This allows same `[jobId]` route to serve two distinct UIs

## Extension Guide

### Adding a New Setup Step

1. Add step definition to `SETUP_SECTIONS` in `constants.ts`:
   ```typescript
   {
     slug: "benefits",
     label: "Benefits",
     icon: "Gift",
   }
   ```
2. Create page component: `benefits/page.tsx`
3. Add fields to `JobSetupState` in `context.tsx`
4. Add setters to context value
5. Update `buildPayload()` to include new fields
6. Add validation logic to `setupValidation.ts` (if needed)

### Adding a New Field to Context

1. Add field to `JobSetupState` interface
2. Add field to `defaultState`
3. Add field to `mapApiToState()` (API → state mapping)
4. Add field to `buildPayload()` (state → API mapping)
5. Add setter function to context value
6. Call setter with `markUnsaved()` to trigger auto-save

### Adding Validation

1. Add validation logic to `lib/validations/setupValidation.ts`
2. Update `isSetupValid()` to include new validation
3. Update `getFirstInvalidSection()` to return error for new field
4. Add error message key to translation files
5. Call validation in `onPublish()` or `goNext()`

### Extending Workspace Mode

To add new workspace sub-routes:

1. Create route under `jobs/[jobId]/` (e.g., `analytics/page.tsx`)
2. Update route detection logic in `JobBranchLayout` if needed
3. Load job data independently (don't rely on context)
4. Use `useParams()` to get `jobId` from URL

### Adding AI Actions

1. Add action to `AI_ACTIONS` array in `layout.tsx`
2. Backend must support action in `/jobs/{id}/ai-description` endpoint
3. Action will automatically appear in AI sheet

### What to Avoid

- Do NOT use context in workspace mode (it's not available)
- Do NOT skip validation on publish (users expect validation)
- Do NOT modify stage normalization logic without updating backend
- Do NOT remove auto-save (users expect changes to persist)
- Do NOT add synchronous saves on every field change (performance issue)
- Do NOT bypass unsaved changes protection (data loss risk)
- Do NOT add new required stages beyond Applied/Hired/Rejected (breaks existing jobs)

## Update Rules

- Update this file ONLY when:
  - Layout hierarchy or routing logic changes
  - Context structure or state management approach changes
  - New setup steps are added
  - Validation strategy changes
  - Auto-save or unsaved changes logic changes
  - Workspace mode integration changes

- Do NOT update for:
  - Minor UI tweaks in setup pages
  - New fields added to existing steps (unless context changes)
  - Styling or responsive layout adjustments
  - Translation updates

- If changes affect global architecture:
  - Also update root /claude.md

- If changes affect only this subsystem:
  - Update ONLY this file

- Always MODIFY existing sections instead of rewriting entire file
