
# Applicant Tracking System (ATS) — Phase 1: Foundation

## Vision
A modern, ultra-clean ATS web app with a black & white SaaS aesthetic inspired by Notion, Linear, and modern AI tools. Desktop-first, keyboard-driven, distraction-free.

---

## Phase 1: Design System & Global Layout

### 1. Design System Setup
- **Color palette**: Pure black, white, neutral grays (5-6 shades), optional soft blue accent for focus/selection states
- **Typography**: Clean modern sans-serif (Inter), consistent scale for headings, body, captions
- **Spacing & layout tokens**: Large whitespace, rounded-xl cards, thin dividers, subtle hover-only shadows
- **Component refinements**: Buttons, inputs, badges, avatars, dropdowns all styled to the minimal B&W aesthetic
- **Dark mode**: Full dark mode support baked into the design tokens from day one

### 2. Global Layout Shell
- **Collapsible left sidebar** with all 11 navigation items (Dashboard, Jobs, Candidates, Pipeline, Interviews, Messages, Talent Pool, Reports, Automations, AI Assistant, Settings)
- Sidebar footer: workspace name, user avatar/profile, dark/light mode toggle
- **Top context bar** showing current page title, breadcrumbs, and quick action buttons
- **Main content canvas** with proper max-width and padding
- **Optional right panel** (placeholder, togglable) for future detail/AI panels
- Smooth collapse/expand animation for sidebar

### 3. Command Palette (⌘K)
- Global search overlay triggered by Cmd+K / Ctrl+K
- Search across pages (navigate to Jobs, Candidates, etc.)
- Quick actions: "Create Job", "Add Candidate", "Schedule Interview"
- Keyboard navigation with arrow keys + Enter

### 4. Micro-Interactions & Polish
- Skeleton loaders for all content areas
- Smooth hover highlights on interactive elements
- Inline toast notifications (using Sonner)
- Keyboard shortcut hints shown in tooltips
- Smart empty states with clear CTAs on each page
- Fast transitions under 150ms

### 5. Page Shells (Placeholder Content)
Each page will be created as a routed page with its basic structure and empty/placeholder state, ready for real content in future phases:
- **Dashboard** — Widget grid layout with placeholder cards (active jobs, pipeline count, interviews today, activity feed)
- **Jobs** — Table view shell with column headers (Role, Department, Status, Candidates, Last Activity) and filter bar
- **Candidates** — Notion-style table shell with custom field columns, tags, filter/search bar
- **Pipeline** — Kanban board layout with configurable stage columns and placeholder cards
- **Interviews** — Calendar-style layout placeholder (day/week toggle)
- **Messages** — Inbox layout with thread list + message detail split view
- **Talent Pool** — Segmented list view with tags and filters
- **Reports** — Chart grid layout with placeholder monochrome chart areas
- **Automations** — Workflow builder placeholder with visual node layout
- **AI Assistant** — Chat panel placeholder
- **Settings** — Tabbed layout (Workspace, Team, Integrations, Custom Fields, Billing)

### 6. Responsive Foundations
- Desktop-first fluid layout
- Sidebar collapses to icon-only on smaller screens
- Content reflows gracefully on tablet widths
- Mobile: simplified single-column layout

---

## What's NOT in Phase 1
- No backend / database / authentication (mock data only)
- No AI features (placeholders only)
- No real drag-and-drop logic (layout only)
- No real calendar integration
- No email/messaging functionality

These will be layered in during subsequent phases once the foundation is solid.
