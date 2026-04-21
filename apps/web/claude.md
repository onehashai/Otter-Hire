# Frontend - AI Context

## Tech Stack

- Next.js 16.2.3 (App Router), React 19, TypeScript
- Tailwind CSS, shadcn/ui components
- React Hook Form, Zod validation
- Sonner (toasts), Lexical (rich text editor)
- react-i18next (i18n)

## Architecture

### Routing

- **App Router**: File-based routing in `src/app`
- **Subdomain logic**: Middleware handles `app.domain.com` vs `jobs.domain.com`
- **Auth guard**: Two-layer gate — server `middleware.ts` redirects unauthenticated requests; client `providers.tsx` re-checks on mount. Both must agree on which routes are public (`LIFECYCLE_ROUTES`: `/verify`, `/onboarding`, `/forgot`, `/reset`)

### Key Routes

- `(auth)/*`: Login, signup, verify, onboarding, invite acceptance, forgot password, password reset
- `(app-page-wrapper)/*`: Authenticated app (jobs, candidates, automations, templates, settings, reports, ai-assistant [coming soon])
- `(job-page-wrapper)/[orgId]/[jobId]`: Public job detail page (careers site)

### API Layer (`src/api`)

- Typed API client wrapping fetch
- Modules: auth, jobs, candidates, organizations, templates, automations, integrations, conversations
- Error handling: 429 rate limit; 401 handling clears session cookies and redirects to login (session refresh is attempted during bootstrap/context)
- Base URL: `NEXT_PUBLIC_API_BASE_URL` (env var)

### State Management

- React Query provider (`@tanstack/react-query`) for client-side server-state caching/fetching
- Client Components for interactivity
- React Context: `PageMetadataContext` (breadcrumbs, page title)
- Global server-state handled by React Query; local UI state uses React state/context

## Key Features

### Jobs

- Create/edit/archive/publish jobs
- AI-generated job descriptions (OpenAI)
- Job stages (pipeline customization)
- Team member assignment
- Email integration per job (inbound resume parsing)

### Candidates

- Candidate profile (resume, contact, notes, activities)
- Move between stages (dialog); column reordering in candidates table uses drag-drop
- Reject with reason
- Multi-job assignment (candidate can apply to multiple jobs)
- Resume parsing (synchronous pipeline; PDF and DOCX supported)
- Resume insights panel: skills, education, work experience, certifications extracted from parsed resume
- Document upload supports PDF and DOCX/DOC; inline preview via backend endpoint (PDF native, DOCX converted to HTML via mammoth)

### Automations

- Visual builder (trigger → actions)
- Triggers: stage-related and candidate/application triggers (partial set)
- Actions: `send_email` currently active; other actions are partial/TODO
- Email preview with template variables
- Execution log

### Templates

- Email templates with rich text editor
- Variable interpolation (e.g. `{{candidate_name}}`, `{{job_title}}`)
- Used in automations and manual emails

### Integrations

- **Email**: SMTP credential storage, per-job inbound email address
- **LinkedIn**: OAuth flow present; job distribution and related flows are partial/coming soon in UI

### Settings

- Profile, organization, team management
- Job categories
- Security: Google account connect/disconnect, password set/change
- Admin panel (platform-level, dev only)

## Components

### Common

- `AppSidebar`: Main navigation
- `TopBar`: User menu, command palette trigger
- `CommandPalette`: Global search (jobs, candidates)
- `ComposeMessageBox`: Rich text email composer

### Domain-specific

- `JobsList`, `CreateJobModal`: Job management
- `CandidatesTable`, `StandaloneCandidateProfile`: Candidate views
- `AutomationsList`, `CreateAutomationDialog`: Automation management
- `TemplatesList`, `TemplateEditor`: Template management

## Middleware Logic

1. **Jobs subdomain**: Only allow public careers routes (`/[orgId]`, `/[orgId]/[jobId]`)
2. **App subdomain**: Enforce auth, redirect to login if no `access_token` cookie
3. **Legacy redirect**: `/{name}-{uuid}` → `/{uuid}` (301)

## Update Rules

- Update this file ONLY when changes affect system architecture, features, or behavior
- Do NOT update for minor changes (UI tweaks, bug fixes, refactoring without behavior change)
- Prefer modifying specific sections instead of rewriting entire file
- Keep summaries concise and high-signal
- Avoid unnecessary updates to maintain stability
