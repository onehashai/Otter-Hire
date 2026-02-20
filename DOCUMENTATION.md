# OneHash ATS – System Documentation

This document describes the actual implementation of three core systems in the OneHash ATS application: Frontend-Backend Communication, Authentication, and the Email Verification + Onboarding Lifecycle.

---

## 1. Frontend ↔ Backend Communication

### Architecture

The frontend (Next.js 14) communicates with the backend (FastAPI) via HTTP requests with cookie-based authentication.

### API Client Configuration

**Location**: `apps/web/src/lib/api.ts`

- **Public API URL**: `process.env.NEXT_PUBLIC_API_URL` (default: `http://localhost:8000`)
- **Internal API URL**: `process.env.API_INTERNAL_URL` (fallback to public URL)
- **Runtime Selection**: Server-side requests use internal URL; client-side uses public URL

### Request Patterns

**GET Requests**:
```typescript
fetch(`${API_BASE_URL}/path`, {
  method: "GET",
  headers: { Accept: "application/json" },
  cache: "no-store"
})
```

**POST Requests**:
```typescript
fetch(`${API_BASE_URL}/path`, {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    Accept: "application/json"
  },
  credentials: "include",  // Critical: sends cookies
  body: JSON.stringify(payload)
})
```

### Cookie Handling

- **Credentials Mode**: All authenticated requests use `credentials: "include"` to send HTTP-only cookies
- **Cookie Name**: `access_token`
- **Set by Backend**: FastAPI sets cookie via `response.set_cookie()` in auth endpoints
- **Automatic Transmission**: Browser automatically includes cookie in subsequent requests

---

## 2. Authentication Architecture

### JWT Token System

**Implementation**: `apps/backend/app/core/security.py`

#### Token Creation

```python
def create_access_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
```

**JWT Payload Structure**:
```json
{
  "user_id": "uuid-string",
  "org_id": "uuid-string",
  "role": "admin|recruiter|hiring_manager|interviewer|owner",
  "exp": 1234567890
}
```

**Token Configuration** (`apps/backend/app/core/config.py`):
- **Secret Key**: `JWT_SECRET_KEY` (environment variable)
- **Algorithm**: `HS256` (default)
- **Expiry**: `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 10080 minutes = 7 days)

#### Token Verification

```python
def verify_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
```

Raises `ValueError` on invalid/expired tokens.

### Cookie Configuration

**Implementation**: `apps/backend/app/api/v1/endpoints/auth.py`

```python
def _set_access_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,           # Prevents JavaScript access
        samesite="lax",          # CSRF protection
        secure=settings.is_production  # HTTPS-only in production
    )
```

**Cookie Attributes**:
- **Name**: `access_token`
- **HttpOnly**: `True` (prevents XSS attacks)
- **SameSite**: `lax` (allows navigation from external sites)
- **Secure**: `True` in production (HTTPS-only)
- **Max-Age**: Not set (session cookie, expires with browser session)

### Authentication Endpoints

**Rate Limiting**: All sensitive auth endpoints are protected with IP-based rate limiting using `slowapi`:

| Endpoint | Rate Limit | Purpose |
|----------|------------|----------|
| POST /auth/login | 5 per 15 minutes | Prevent brute force attacks |
| POST /auth/signup | 5 per 15 minutes | Prevent spam registrations |
| POST /auth/verify | 10 per 15 minutes | Allow multiple verification attempts |
| POST /auth/resend-verification | 5 per 15 minutes | Prevent email flooding |

**Rate Limit Response** (429 Too Many Requests):
```json
{
  "error": "Rate limit exceeded: 5 per 15 minute"
}
```

**Implementation**: `apps/backend/app/api/v1/endpoints/auth.py`
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/15 minutes")
async def login(request: Request, ...):
    # endpoint logic
```

**Storage**: In-memory (suitable for MVP/single-instance deployments)

**Unprotected Endpoints**: `/auth/me`, `/auth/logout`, `/auth/onboarding` (no rate limits)

#### POST /auth/signup

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"  // optional
}
```

**Process**:
1. Normalizes email to lowercase
2. Checks for existing user
3. Creates organization with auto-generated name
4. Generates verification token (32-byte URL-safe, SHA256 hashed)
5. Creates user with `is_verified=False`, `is_onboarded=False`
6. Sends verification email
7. Creates JWT and sets cookie
8. Returns user data

**Response**: `AuthUserResponse` (201 Created)

#### POST /auth/login

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Process**:
1. Normalizes email to lowercase
2. Fetches user from database
3. Verifies password using bcrypt
4. Creates JWT with user_id, org_id, role
5. Sets access_token cookie
6. Returns user data

**Response**: `AuthUserResponse` (200 OK)

#### GET /auth/me

**Authentication**: Requires valid JWT cookie

**Process**:
1. Extracts `access_token` from cookies
2. Verifies JWT signature and expiry
3. Fetches user from database using `user_id` and `org_id`
4. Returns user data

**Response**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "admin",
  "org_id": "uuid",
  "is_verified": true,
  "is_onboarded": true
}
```

#### POST /auth/logout

**Process**:
1. Deletes `access_token` cookie
2. Returns 204 No Content

### User Dependency System

**Location**: `apps/backend/app/deps/auth.py`

#### get_current_user

```python
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Cookie(default=None)
) -> User
```

**Process**:
1. Checks for `access_token` cookie (raises 401 if missing)
2. Verifies JWT (raises 401 if invalid)
3. Extracts `user_id` and `org_id` from payload
4. Queries database for user (raises 401 if not found)
5. Returns User model instance

**Used by**: `/auth/me`, `/auth/onboarding`

#### require_active_user

```python
async def require_active_user(current_user: User = Depends(get_current_user)) -> User
```

**Process**:
1. Calls `get_current_user` to authenticate
2. Checks `is_verified` (raises 403 if False)
3. Checks `is_onboarded` (raises 403 if False)
4. Returns user

**Purpose**: Enforces lifecycle completion at API level

**Usage**: Apply to protected endpoints requiring fully onboarded users

### Database Schema

**User Model** (`apps/backend/app/models/user.py`):

```python
class User(Base):
    id: UUID (primary key)
    org_id: UUID (foreign key to organizations)
    email: String (unique per org)
    hashed_password: String
    name: String
    role: String (owner|admin|recruiter|hiring_manager|interviewer)
    status: String (invited|active|disabled)
    is_verified: Boolean (default: False)
    verified_at: DateTime (nullable)
    verification_token_hash: String (nullable)
    verification_token_expires_at: DateTime (nullable)
    is_onboarded: Boolean (default: False)
    created_at: DateTime
    updated_at: DateTime
```

**Organization Model** (`apps/backend/app/models/organization.py`):

```python
class Organization(Base):
    id: UUID (primary key)
    name: String
    created_at: DateTime
    updated_at: DateTime
```

---

## 3. Email Verification System

### Token Generation

**Implementation**: `apps/backend/app/api/v1/endpoints/auth.py` (signup endpoint)

```python
raw_token = secrets.token_urlsafe(32)  # 32 bytes = 43 characters base64
token_hash = sha256(raw_token.encode()).hexdigest()
token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
```

**Token Properties**:
- **Raw Token**: 32-byte URL-safe random string (sent to user)
- **Stored Hash**: SHA256 hash of raw token (stored in database)
- **Expiry**: 24 hours from generation
- **Security**: Raw token never stored; only hash is persisted

### Database Storage

**User Table Columns**:
- `verification_token_hash`: SHA256 hash of the token
- `verification_token_expires_at`: Expiry timestamp (UTC)
- `is_verified`: Boolean flag (default: False)
- `verified_at`: Timestamp when verification completed (nullable)

### Verification URL Format

```
{FRONTEND_BASE_URL}/verify?token={raw_token}
```

Example: `http://localhost:3000/verify?token=abc123...`

### POST /auth/verify

**Request**:
```json
{
  "token": "raw-token-from-url"
}
```

**Process**:
1. Hashes incoming token with SHA256
2. Queries database for user with matching hash and non-expired token
3. If found:
   - Sets `is_verified = True`
   - Sets `verified_at = now()`
   - Clears `verification_token_hash` and `verification_token_expires_at`
   - Commits to database
4. Returns success response

**Response**:
```json
{
  "ok": true
}
```

**Error Cases**:
- Invalid token: 400 Bad Request
- Expired token: 400 Bad Request
- Token not found: 400 Bad Request

### POST /auth/resend-verification

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Process**:
1. Normalizes email to lowercase
2. Fetches user from database
3. If user exists and `is_verified=False`:
   - Generates new token (same process as signup)
   - Updates `verification_token_hash` and `verification_token_expires_at`
   - Sends new verification email
4. Always returns success (prevents email enumeration)

**Response**:
```json
{
  "ok": true
}
```

### Frontend Verification Flow

**Location**: `apps/web/src/app/(auth)/verify/page.tsx`

**Process**:
1. Extracts `token` from URL query parameters
2. Calls `verifyEmail(token)` API
3. On success:
   - Removes `signup_email` from sessionStorage
   - Calls `refreshSession()` to update context
   - Triggers cross-tab sync via `localStorage.setItem("session_updated", timestamp)`
   - Redirects to `/onboarding`
4. On error: Displays error message

**Resend Functionality**:
- 30-second cooldown timer
- Timer persisted in sessionStorage (survives page refresh)
- Email retrieved from sessionStorage (set during signup)

---

## 4. Onboarding Flow

### Purpose

Collects user's full name and organization name after email verification.

### POST /auth/onboarding

**Authentication**: Requires valid JWT cookie

**Request**:
```json
{
  "full_name": "John Doe",
  "organization_name": "Acme Inc"
}
```

**Preconditions**:
1. User must be authenticated (JWT cookie present)
2. User must be verified (`is_verified=True`)
3. User must not be already onboarded (`is_onboarded=False`)

**Process**:
1. Validates user is verified (raises 403 if not)
2. Validates user is not already onboarded (raises 400 if already done)
3. Updates user record:
   - `name = full_name`
   - `is_onboarded = True`
4. Updates organization record:
   - `name = organization_name`
5. Commits to database
6. **Regenerates JWT** with same payload structure
7. Sets new cookie
8. Returns updated user data

**Response**: `AuthUserResponse` (200 OK)

**Error Cases**:
- Not verified: 403 Forbidden ("Email verification required")
- Already onboarded: 400 Bad Request ("User already onboarded")

### JWT Regeneration

**Why**: Ensures cookie freshness and extends session after onboarding

**Implementation**:
```python
token = create_access_token({
    "user_id": str(current_user.id),
    "org_id": str(current_user.org_id),
    "role": current_user.role,
})
_set_access_cookie(response, token)
```

**Note**: Payload structure remains identical; only expiry is refreshed

### Frontend Onboarding Flow

**Location**: `apps/web/src/app/(auth)/onboarding/page.tsx`

**Process**:
1. User submits form with full name and organization name
2. Calls `completeOnboarding()` API
3. On success:
   - Calls `refreshSession()` to update context
   - Triggers cross-tab sync via `localStorage.setItem("session_updated", timestamp)`
   - Redirects to `/` (dashboard)
4. On error: Displays error message

---

## 5. Lifecycle State Machine

### User States

```
┌─────────────┐
│ Unauthenticated │
└──────┬──────┘
       │ signup/login
       ▼
┌─────────────────┐
│  Authenticated   │
│  is_verified=F   │
│  is_onboarded=F  │
└──────┬──────────┘
       │ verify email
       ▼
┌─────────────────┐
│  Authenticated   │
│  is_verified=T   │
│  is_onboarded=F  │
└──────┬──────────┘
       │ complete onboarding
       ▼
┌─────────────────┐
│  Authenticated   │
│  is_verified=T   │
│  is_onboarded=T  │
│  (ACTIVE USER)   │
└─────────────────┘
```

### State Transitions

| Current State | Action | Next State | Redirect |
|--------------|--------|------------|----------|
| No cookie | - | Unauthenticated | `/login` |
| Cookie + is_verified=F | - | Awaiting Verification | `/verify` |
| Cookie + is_verified=T + is_onboarded=F | - | Awaiting Onboarding | `/onboarding` |
| Cookie + is_verified=T + is_onboarded=T | - | Active User | `/` (dashboard) |

### Route Access Matrix

| Route | Unauthenticated | Verified=F | Verified=T, Onboarded=F | Active User |
|-------|----------------|------------|------------------------|-------------|
| `/login` | ✅ Allow | ❌ Redirect to `/verify` | ❌ Redirect to `/onboarding` | ❌ Redirect to `/` |
| `/signup` | ✅ Allow | ❌ Redirect to `/verify` | ❌ Redirect to `/onboarding` | ❌ Redirect to `/` |
| `/verify` | ❌ Redirect to `/login` | ✅ Allow | ❌ Redirect to `/onboarding` | ❌ Redirect to `/` |
| `/onboarding` | ❌ Redirect to `/login` | ❌ Redirect to `/verify` | ✅ Allow | ❌ Redirect to `/` |
| `/` (dashboard) | ❌ Redirect to `/login` | ❌ Redirect to `/verify` | ❌ Redirect to `/onboarding` | ✅ Allow |

---

## 6. Enforcement Layers

The system implements three layers of lifecycle enforcement to ensure security and proper user flow.

### Layer 1: Middleware (Edge)

**Location**: `apps/web/src/middleware.ts`

**Scope**: Runs on every request before page render

**Logic**:
```typescript
const AUTH_ROUTES = ["/login", "/signup"]
const LIFECYCLE_ROUTES = ["/verify", "/onboarding"]
const PUBLIC_ROUTES = ["/health", "/favicon.ico"]

if (AUTH_ROUTES.has(pathname)) {
  if (hasAccessToken) redirect to "/"
  else allow
}

if (LIFECYCLE_ROUTES.has(pathname)) {
  allow  // No cookie check
}

if (PUBLIC_ROUTES.has(pathname)) {
  allow
}

if (!hasAccessToken) {
  redirect to "/login"
}

allow
```

**Enforcement**:
- Checks for `access_token` cookie presence (not validity)
- Redirects unauthenticated users to `/login`
- Redirects authenticated users away from auth pages
- Allows lifecycle routes without cookie check

**Limitations**:
- Cannot read cookie value (HttpOnly)
- Cannot validate JWT
- Cannot check `is_verified` or `is_onboarded` flags

### Layer 2: Provider (Client)

**Location**: `apps/web/src/app/providers.tsx`

**Scope**: Runs after page load, manages session state

**Session Loading**:
```typescript
const refreshSession = async () => {
  try {
    const me = await getAuthSession()  // GET /auth/me
    setUser(me)
  } catch {
    setUser(null)
  } finally {
    setLoading(false)
  }
}
```

**Lifecycle Enforcement**:
```typescript
useEffect(() => {
  if (loading) return

  if (!user) {
    if (!isAuthRoute && !isLifecycleRoute) {
      router.replace("/login")
    }
    return
  }

  if (!user.is_verified) {
    if (pathname !== "/verify") {
      router.replace("/verify")
    }
    return
  }

  if (!user.is_onboarded) {
    if (pathname !== "/onboarding") {
      router.replace("/onboarding")
    }
    return
  }

  if (isAuthRoute || isLifecycleRoute) {
    router.replace("/")
  }
}, [user, loading, pathname, router])
```

**Loading Guard**:
```typescript
if (loading) {
  return <LoadingSpinner />  // Blocks render until session resolves
}
```

**Cross-Tab Synchronization**:
```typescript
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === "session_updated" && e.newValue) {
      void refreshSession()
    }
  }
  window.addEventListener("storage", handleStorageChange)
  return () => window.removeEventListener("storage", handleStorageChange)
}, [])
```

**Trigger Mechanism**:
- After verification: `localStorage.setItem("session_updated", Date.now())`
- After onboarding: `localStorage.setItem("session_updated", Date.now())`
- Other tabs detect change and call `refreshSession()`

**Enforcement**:
- Validates JWT by calling `/auth/me`
- Checks `is_verified` and `is_onboarded` flags
- Redirects based on user state
- Prevents UI flicker with loading guard

**Limitations**:
- Client-side only (can be bypassed with dev tools)
- Requires JavaScript enabled

### Layer 3: Backend Dependency (API)

**Location**: `apps/backend/app/deps/auth.py`

**Scope**: Runs on every protected API endpoint

**get_current_user**:
```python
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Cookie(default=None)
) -> User:
    if not access_token:
        raise HTTPException(401, "Not authenticated")
    
    payload = verify_access_token(access_token)  # Validates JWT
    user_id = UUID(payload.get("user_id"))
    org_id = UUID(payload.get("org_id"))
    
    user = await db.execute(
        select(User).where(User.id == user_id, User.org_id == org_id)
    )
    if user is None:
        raise HTTPException(401, "User not found")
    
    return user
```

**require_active_user**:
```python
async def require_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_verified:
        raise HTTPException(403, "Email verification required")
    
    if not current_user.is_onboarded:
        raise HTTPException(403, "Onboarding required")
    
    return current_user
```

**Usage**:
```python
@router.get("/protected-endpoint")
async def protected_route(user: User = Depends(require_active_user)):
    # Only fully onboarded users can access
    pass
```

**Enforcement**:
- Validates JWT signature and expiry
- Verifies user exists in database
- Checks `is_verified` and `is_onboarded` flags
- Returns 403 Forbidden if lifecycle incomplete

**Purpose**: Server-side enforcement prevents API bypass via curl/Postman

### Why Three Layers?

1. **Middleware**: Fast edge-level routing, prevents unnecessary page loads
2. **Provider**: Rich client-side UX, smooth redirects, cross-tab sync
3. **Backend**: Security enforcement, prevents API abuse, authoritative source of truth

**Defense in Depth**: Each layer compensates for limitations of others, ensuring robust lifecycle enforcement.

---

## Change Log (Append Only)

- 2026-02-19: Session synchronization fix — added `force` parameter to `refreshSession()` and `clearSession()` to auth context. Fixes logout→login race condition where stale inflight promise blocked fresh `/auth/me` call. Login page now calls `refreshSession(true)`, logout calls `clearSession()` before redirect.
- 2026-02-19: Frontend fully wired to backend API — replaced all mock/placeholder data with real API calls. Jobs list page, job wizard (create/edit), autosave with 1.5s debounce, publish/unpublish/close workflows all connected to backend endpoints. snake_case↔camelCase field mapping at API boundary.
- 2026-02-19: Authentication lifecycle — login, signup, email verification, onboarding, and logout all working end-to-end. Provider-based redirect enforcement (unverified→/verify, not onboarded→/onboarding, active→dashboard). Cross-tab session sync via localStorage events.
- 2026-02-19: Folder restructure merged from main — `(dashboard)` renamed to `(app-page-wrapper)`, `[id]` renamed to `[jobId]` in jobs routes, CSS files moved to `styles/`, new `(job-page-wrapper)` route group added for public job pages.
- 2026-02-18: Jobs backend V1 implemented — expanded Job model with 20+ fields, created JobTeamMember model, Alembic migration, Pydantic schemas, 7 API endpoints (create, update, list, detail, publish, close, unpublish) with multi-tenancy enforcement via JWT org_id.
- 2026-02-18: Added JOB DOMAIN CONTRACT (Frozen – V1) section
- 2026-02-18: Initial Replit environment setup — Next.js proxy rewrites, async DB URL handling, environment variables, workflow configuration

---

# JOB DOMAIN CONTRACT (Frozen – V1)

> **Status**: Frozen — this document is the single source of truth for the Jobs domain.
> **Date**: 2026-02-18
> **Author**: System Architect

---

## 1. Overview

This contract defines the canonical data model, enums, state machine, API shape, and multi-tenancy rules for the Job entity in OneHash ATS. It reconciles the frontend's assumed structure with the backend's current (minimal) schema and prescribes the final normalized design that both sides must converge on.

---

## 2. Frontend ↔ Backend Mismatch Analysis

### 2.1 Fields present in frontend but missing in backend

| Frontend Field | Frontend Type | Backend Status |
|---|---|---|
| `department` | string enum | **Missing** — backend has no column |
| `workplaceType` | string enum (remote/hybrid/onsite) | **Missing** |
| `country` | ISO country code string | **Missing** — backend has single `location` column |
| `city` | string | **Missing** — merged into `location` |
| `hiringManager` | string (name) | **Missing** — no column or FK |
| `openings` | number | **Missing** |
| `salaryType` | enum (hidden/fixed/range) | **Missing** |
| `salaryFixed` | string (used as number) | **Missing** |
| `salaryMin` | string (used as number) | **Missing** |
| `salaryMax` | string (used as number) | **Missing** |
| `currency` | string (ISO currency code) | **Missing** |
| `timeframe` | enum (per_year/per_month/…) | **Missing** |
| `visibility` | enum (internal/careers/public) | **Missing** |
| `collectResume` | boolean | **Missing** |
| `collectCover` | boolean | **Missing** |
| `screeningQuestions` | string[] | **Missing** |
| `pipeline` | string (template name) | **Missing** |

### 2.2 Status enum mismatch

| Layer | Values |
|---|---|
| Frontend (`constants.ts`) | `draft`, `open`, `closed` |
| Backend DB constraint (`ck_jobs_status`) | `draft`, `published`, `closed` |

**Decision**: Canonical status values are **`draft`, `open`, `closed`**. The backend constraint must be migrated from `published` → `open`.

### 2.3 Naming conflicts within frontend

| Jobs List Page (`page.tsx`) | Job Setup (`context.tsx`) | Canonical Name |
|---|---|---|
| `role` | `title` | **`title`** |
| `dept` | `department` | **`department`** |
| `type` | `employmentType` | **`employment_type`** |
| `stages` (old: `{name, interviewer}`) | `hiringStages` (`{id, name}`) | **`hiring_stages`** (use `hiringStages` format) |

### 2.4 Salary handling

Frontend stores salary values as **strings** (`salaryFixed: ""`, `salaryMin: "140000"`). The canonical schema must use **numeric types** (integer cents or `NUMERIC`).

### 2.5 Team members

Frontend stores full objects `{id, name, email, role}` inline. The canonical design uses a **join table** (`job_team_members`) storing only `user_id` + `role`, with user details resolved via JOIN.

---

## 3. Canonical Job DB Schema

### 3.1 `jobs` table

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → `organizations.id` |
| `created_by_user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `title` | VARCHAR(255) | NOT NULL | — | Job title (1–100 chars enforced at API) |
| `description` | TEXT | NULL | — | Rich HTML content |
| `department` | VARCHAR(50) | NULL | — | Enum stored as string |
| `employment_type` | VARCHAR(20) | NULL | `'full_time'` | Enum stored as string |
| `workplace_type` | VARCHAR(10) | NULL | `'remote'` | Enum stored as string |
| `country` | VARCHAR(3) | NULL | — | ISO 3166-1 alpha-2 code |
| `city` | VARCHAR(255) | NULL | — | Free-text, may include state code |
| `openings` | INTEGER | NOT NULL | `1` | Min 1 |
| `salary_type` | VARCHAR(10) | NOT NULL | `'hidden'` | Enum stored as string |
| `salary_min` | INTEGER | NULL | — | Cents (or whole currency units); required when salary_type = 'range' |
| `salary_max` | INTEGER | NULL | — | Cents; required when salary_type = 'range' |
| `salary_fixed` | INTEGER | NULL | — | Cents; required when salary_type = 'fixed' |
| `currency` | VARCHAR(3) | NULL | `'USD'` | ISO 4217 currency code |
| `salary_timeframe` | VARCHAR(10) | NULL | `'per_year'` | Enum stored as string |
| `status` | VARCHAR(10) | NOT NULL | `'draft'` | Enum: draft, open, closed |
| `visibility` | VARCHAR(10) | NOT NULL | `'internal'` | Enum: internal, careers, public |
| `collect_resume` | BOOLEAN | NOT NULL | `TRUE` | Application form config |
| `collect_cover` | BOOLEAN | NOT NULL | `FALSE` | Application form config |
| `screening_questions` | JSONB | NULL | `'[]'` | Array of question strings |
| `pipeline_template` | VARCHAR(20) | NULL | `'standard'` | Template used at creation |
| `published_at` | TIMESTAMPTZ | NULL | — | Set when status → open |
| `closed_at` | TIMESTAMPTZ | NULL | — | Set when status → closed |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Auto-updated |

**Indexes**:
- `ix_jobs_org_id` on `(org_id)`
- `ix_jobs_org_status` on `(org_id, status)`

**Check constraints**:
- `ck_jobs_status`: `status IN ('draft', 'open', 'closed')`
- `ck_jobs_visibility`: `visibility IN ('internal', 'careers', 'public')`
- `ck_jobs_salary_type`: `salary_type IN ('hidden', 'fixed', 'range')`
- `ck_jobs_salary_range`: `salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max`

**Removed fields** (compared to current backend):
- `location` — replaced by separate `country` + `city` columns

### 3.2 `hiring_stages` table (replaces current `stages` table)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → `organizations.id` |
| `job_id` | UUID | NOT NULL | — | FK → `jobs.id` ON DELETE CASCADE |
| `name` | VARCHAR(100) | NOT NULL | — | Stage display name |
| `position` | INTEGER | NOT NULL | — | 0-based ordering index |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Indexes**:
- `ix_hiring_stages_job_position` on `(job_id, position)` UNIQUE

**Constraints**:
- Minimum 2 stages per job (enforced at API level, not DB)
- `position` must be contiguous starting from 0 (enforced at API level)

**Default stages** (created automatically for new jobs):
1. Applied (position 0)
2. Screening (position 1)
3. Interview (position 2)
4. Offer (position 3)
5. Hired (position 4)

### 3.3 `job_team_members` table (NEW — join table)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `org_id` | UUID | NOT NULL | — | FK → `organizations.id` |
| `job_id` | UUID | NOT NULL | — | FK → `jobs.id` ON DELETE CASCADE |
| `user_id` | UUID | NOT NULL | — | FK → `users.id` |
| `role` | VARCHAR(20) | NOT NULL | — | Enum: hiring_manager, recruiter, interviewer, coordinator |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | — |

**Indexes**:
- `uq_job_team_member` UNIQUE on `(job_id, user_id)` — one role per user per job
- `ix_job_team_members_job` on `(job_id)`

**Constraints**:
- `ck_job_team_role`: `role IN ('hiring_manager', 'recruiter', 'interviewer', 'coordinator')`

---

## 4. Enum Definitions

### 4.1 Department

```
engineering | design | marketing | sales | data | operations | hr
```

Stored as VARCHAR. Extensible — no DB constraint. Validated at API level.

### 4.2 Employment Type

```
full_time | part_time | contract | internship
```

### 4.3 Workplace Type

```
remote | hybrid | onsite
```

### 4.4 Job Status

```
draft | open | closed
```

### 4.5 Visibility

```
internal | careers | public
```

### 4.6 Salary Type

```
hidden | fixed | range
```

### 4.7 Salary Timeframe

```
per_year | per_month | per_week | per_day | per_hour
```

### 4.8 Team Role

```
hiring_manager | recruiter | interviewer | coordinator
```

---

## 5. Status State Machine

```
                    publish
  ┌───────┐    ──────────────►    ┌──────┐
  │ draft │                       │ open │
  └───┬───┘    ◄──────────────    └──┬───┘
      │            unpublish         │
      │                              │
      │          close               │  close
      └──────────────┐    ┌─────────┘
                     ▼    ▼
                   ┌────────┐
                   │ closed │
                   └────────┘
```

### Allowed Transitions

| From | To | Action | Side Effects |
|---|---|---|---|
| `draft` | `open` | Publish | Set `published_at = now()`, validate required fields |
| `open` | `draft` | Unpublish | Clear `published_at` |
| `open` | `closed` | Close | Set `closed_at = now()` |
| `draft` | `closed` | Close | Set `closed_at = now()` |
| `closed` | — | (terminal) | No transitions out of closed |

### Publish Validation (draft → open)

Before a job can transition to `open`, the following must be present:
- `title` (non-empty, 1–100 chars)
- At least 2 hiring stages
- `salary_fixed` required if `salary_type = 'fixed'`
- `salary_min` and `salary_max` required if `salary_type = 'range'`
- `salary_min <= salary_max` when both present

---

## 6. Visibility Rules

| Value | Meaning | Who Can See |
|---|---|---|
| `internal` | Visible only within the organization | Org members only |
| `careers` | Listed on the company careers page | Anyone with careers page access |
| `public` | Listed on public job boards | Anyone on the internet |

Visibility is independent of status — a `draft` job with `public` visibility is not shown anywhere until status = `open`.

---

## 7. API Contract

All endpoints are prefixed with `/jobs`. All require authentication via `require_active_user` dependency. All enforce `org_id` from JWT — never from client payload.

### 7.1 POST /jobs — Create Job

**Request Body**:
```json
{
  "title": "Senior Frontend Engineer"
}
```

Only `title` is required at creation. All other fields use defaults. This matches the frontend flow where the user enters a job name in a dialog and is taken to the setup wizard.

**Response** (201 Created):
```json
{
  "id": "uuid",
  "title": "Senior Frontend Engineer",
  "department": null,
  "employment_type": "full_time",
  "workplace_type": "remote",
  "country": null,
  "city": null,
  "openings": 1,
  "salary_type": "hidden",
  "salary_fixed": null,
  "salary_min": null,
  "salary_max": null,
  "currency": "USD",
  "salary_timeframe": "per_year",
  "description": null,
  "status": "draft",
  "visibility": "internal",
  "collect_resume": true,
  "collect_cover": false,
  "screening_questions": [],
  "pipeline_template": "standard",
  "hiring_stages": [
    { "id": "uuid", "name": "Applied", "position": 0 },
    { "id": "uuid", "name": "Screening", "position": 1 },
    { "id": "uuid", "name": "Interview", "position": 2 },
    { "id": "uuid", "name": "Offer", "position": 3 },
    { "id": "uuid", "name": "Hired", "position": 4 }
  ],
  "team_members": [],
  "created_by_user_id": "uuid",
  "published_at": null,
  "closed_at": null,
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

### 7.2 PATCH /jobs/{id} — Update Job

**Request Body** (all fields optional):
```json
{
  "title": "Updated Title",
  "department": "engineering",
  "employment_type": "full_time",
  "workplace_type": "remote",
  "country": "US",
  "city": "San Francisco|CA",
  "openings": 2,
  "salary_type": "range",
  "salary_min": 140000,
  "salary_max": 180000,
  "salary_fixed": null,
  "currency": "USD",
  "salary_timeframe": "per_year",
  "description": "<p>HTML content</p>",
  "visibility": "careers",
  "collect_resume": true,
  "collect_cover": false,
  "screening_questions": ["Why are you interested?"],
  "pipeline_template": "standard",
  "hiring_stages": [
    { "id": "existing-uuid", "name": "Applied", "position": 0 },
    { "id": null, "name": "New Stage", "position": 1 }
  ],
  "team_members": [
    { "user_id": "uuid", "role": "hiring_manager" },
    { "user_id": "uuid", "role": "interviewer" }
  ]
}
```

**Hiring stages update strategy**: Full replacement — client sends the complete ordered list. Stages with `id = null` are created; existing stages not in the list are deleted; stages with existing IDs are updated.

**Team members update strategy**: Full replacement — client sends the complete list. Members not in the list are removed.

**Response** (200 OK): Same shape as POST response.

### 7.3 GET /jobs — List Jobs

**Query Parameters**:
- `status` (optional, comma-separated): filter by status
- `department` (optional, comma-separated): filter by department
- `employment_type` (optional, comma-separated): filter by type
- `search` (optional): full-text search on title
- `page` (optional, default 1): pagination
- `per_page` (optional, default 20, max 100): page size

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Senior Frontend Engineer",
      "department": "engineering",
      "employment_type": "full_time",
      "status": "open",
      "candidate_count": 34,
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601"
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20
}
```

List response is a **summary projection** — does not include description, stages, team, or salary details.

### 7.4 GET /jobs/{id} — Get Job Detail

**Response** (200 OK): Same shape as POST response (full object with stages and team).

### 7.5 POST /jobs/{id}/publish — Publish Job

Transitions `draft` → `open`. Validates required fields. Returns 400 if validation fails.

**Response** (200 OK): Full job object with `status: "open"` and `published_at` set.

### 7.6 POST /jobs/{id}/close — Close Job

Transitions `open` or `draft` → `closed`.

**Response** (200 OK): Full job object with `status: "closed"` and `closed_at` set.

### 7.7 POST /jobs/{id}/unpublish — Unpublish Job

Transitions `open` → `draft`. Clears `published_at`.

**Response** (200 OK): Full job object with `status: "draft"`.

---

## 8. Multi-Tenancy Enforcement

| Rule | Enforcement |
|---|---|
| `org_id` source | Always extracted from JWT `org_id` claim — NEVER from request body or query params |
| Job creation | `org_id` set from authenticated user's JWT |
| Job queries | All queries include `WHERE org_id = :jwt_org_id` |
| Hiring stages | Inherit `org_id` from parent job; queries always scoped |
| Team members | `user_id` must belong to the same `org_id`; validated on write |
| Cross-org access | Returns 404 (not 403) to avoid leaking existence |

---

## 9. Migration Implications

### 9.1 Changes to existing `jobs` table

- **ADD** columns: `department`, `workplace_type`, `country`, `city`, `openings`, `salary_type`, `salary_min`, `salary_max`, `salary_fixed`, `currency`, `salary_timeframe`, `visibility`, `collect_resume`, `collect_cover`, `screening_questions`, `pipeline_template`, `published_at`, `closed_at`
- **DROP** column: `location` (replaced by `country` + `city`)
- **ALTER** constraint `ck_jobs_status`: change `'published'` → `'open'`
- **ADD** constraints: `ck_jobs_visibility`, `ck_jobs_salary_type`, `ck_jobs_salary_range`
- **ADD** index: `ix_jobs_org_status`

### 9.2 Changes to existing `stages` table

- **RENAME** table from `stages` to `hiring_stages` (or keep `stages` and alias in code)
- **ADD** `ON DELETE CASCADE` to `job_id` FK
- **ADD** unique constraint on `(job_id, position)`

### 9.3 New table

- **CREATE** `job_team_members` table

### 9.4 Data migration

- Any existing jobs with `status = 'published'` must be updated to `status = 'open'`
- The `location` column data should be mapped to `country` + `city` if possible, otherwise set to NULL

---

## 10. Notes on Removed/Renamed Frontend Fields

| Frontend Field | Decision | Rationale |
|---|---|---|
| `role` (list page) | Rename to `title` | Align with canonical field name |
| `dept` (list page) | Rename to `department` | Align with canonical field name |
| `type` (list page) | Rename to `employment_type` | Align with canonical field name |
| `hiringManager` (string name) | Remove | Replaced by `job_team_members` with `role = 'hiring_manager'` |
| `salaryFixed` / `salaryMin` / `salaryMax` (strings) | Convert to integers | Salary must be numeric in DB |
| `stages` (old `{name, interviewer}`) | Remove | Legacy format; replaced by `hiring_stages` |
| `published` (boolean) | Remove | Derived from `status === 'open'` |
| `linkCopied` / `savedAt` / `citySearch` / `newQuestion` / `aiSheetOpen` / `summaryOpen` / `basicInfoAttemptedNext` / `hiringDetailsAttemptedSave` | UI-only state | Not persisted; remain in frontend context only |
| `mockWorkspaceUsers` / `mockJob` | Remove | Replace with real API data |

---

*End of JOB DOMAIN CONTRACT (Frozen – V1)*

---

# AUTHORIZATION & PERMISSIONS (V2 ATS Roles)

## Role Definitions

| Role | Description |
|---|---|
| **owner** | Full access: all data, system settings, billing, account deletion |
| **admin** | Add/remove users, configure workflows/jobs, view/edit all candidates, reports. Cannot alter billing or delete accounts |
| **recruiter** | Source/screen candidates, schedule interviews, update stages, post jobs. No admin/system settings |
| **hiring_manager** | View candidates for assigned jobs, add feedback/notes, approve stages. Limited to assigned jobs only |
| **interviewer** | View candidate profiles for assigned jobs, add interview notes/feedback. Cannot edit stages or access unassigned jobs |
| **employee** | View jobs and reports (read-only, org-wide). No edits |

## Permissions

| Permission | owner | admin | recruiter | hiring_manager | interviewer | employee |
|---|---|---|---|---|---|---|
| `users:read` | Y | Y | - | - | - | - |
| `users:invite` | Y | Y | - | - | - | - |
| `users:update_role` | Y | Y | - | - | - | - |
| `users:remove` | Y | Y | - | - | - | - |
| `jobs:read` | Y | Y | Y | Y (assigned) | Y (assigned) | Y (org-wide) |
| `jobs:create` | Y | Y | Y | - | - | - |
| `jobs:update` | Y | Y | Y | - | - | - |
| `jobs:publish` | Y | Y | Y | - | - | - |
| `jobs:close` | Y | Y | Y | - | - | - |
| `jobs:unpublish` | Y | Y | Y | - | - | - |

## Job Scope Enforcement

- **owner / admin / recruiter**: Access all jobs within their organization.
- **hiring_manager / interviewer**: Can only access jobs where they appear in `job_team_members` (assigned-only). GET /jobs list is pre-filtered; GET /jobs/{id} returns 403 if not assigned.
- **employee**: Can read all jobs in the organization (org-wide read), but cannot create, edit, publish, close, or unpublish.

## Users Endpoint Enforcement

- **GET /users**: owner/admin only (`users:read`)
- **POST /users/invite**: owner/admin only (`users:invite`). Default role for invited users = `employee` (least privilege).
- **PATCH /users/{id}/role**: owner/admin only (`users:update_role`). Assignable roles: admin, recruiter, hiring_manager, interviewer, employee. Owner can never be assigned via API. Existing owner cannot be modified or demoted.
- **DELETE /users/{id}**: owner/admin only (`users:remove`). Owner can never be deleted.

## Error Behavior

- **Cross-org access** (job or user belongs to different org): **404** — resource appears to not exist.
- **Same org, insufficient permission**: **403** — "Insufficient permissions" or "Job access denied".

## Implementation Files

- `apps/backend/app/core/permissions.py` — Permission constants, ROLE_PERMISSIONS map, `has_permission()`, `require_permission()` dependency
- `apps/backend/app/deps/job_scope.py` — `require_job_access()` helper for assigned-only enforcement
- `apps/backend/app/deps/roles.py` — Legacy `require_role()` (still available but superseded by `require_permission`)

## Notes

- Candidates permissions are not yet implemented (future phase).
- Billing/account-delete permissions exist conceptually for owner but no endpoints exist yet.
- Authentication (JWT, cookies, /auth/me, require_active_user) is unchanged.

---

# TEAM MANAGEMENT

## Overview

Team Management allows organization owners and admins to invite users, assign roles, and manage team members. The system enforces role-based permissions and prevents unauthorized modifications to critical roles (owner, admin).

## Frontend Implementation

**Location**: `apps/web/src/app/(app-page-wrapper)/settings/team/page.tsx`

### Features

- **List Team Members**: Displays all users in the organization with their name, email, role, and status (active/invited)
- **Invite Users**: Send email invitations to new team members (default role: employee)
- **Change Roles**: Update user roles (owner/admin can modify roles based on permissions)
- **Remove Users**: Delete team members from the organization
- **Resend Invites**: Resend invitation emails to pending users
- **Permission Checks**: UI disables actions based on current user's role and target user's role

### API Integration

All team management operations call real backend endpoints:

- **GET /users** — Fetch all organization users
- **POST /users/invite** — Invite new user by email
- **PATCH /users/{id}/role** — Update user role
- **DELETE /users/{id}** — Remove user from organization

### Error Handling

- **403 Forbidden**: Displays "You don't have permission to manage team members" message
- **429 Rate Limited**: Shows rate limit error with retry-after time
- **Network Errors**: Displays error message with retry button

### UI Components

- **TeamMembers** (`teamMembers.tsx`): Renders user list with actions dropdown
- **TeamInviteModal** (`teamInviteModal.tsx`): Email input form for invitations
- **RolesAndPermissionsTable** (`rolesAndPermissionsTable.tsx`): Permission matrix reference

## Backend Implementation

**Location**: `apps/backend/app/api/v1/endpoints/users.py`

### Endpoints

#### GET /users

**Authentication**: Requires `users:read` permission (owner/admin only)

**Response**:
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "recruiter",
    "status": "active"
  }
]
```

**Enforcement**: Returns only users within the authenticated user's organization

#### POST /users/invite

**Authentication**: Requires `users:invite` permission (owner/admin only)

**Request**:
```json
{
  "email": "newuser@example.com",
  "name": "Jane Smith"  // optional
}
```

**Process**:
1. Checks if user already exists in organization
2. If user exists with status "invited", regenerates invite token and resends email
3. If user exists with status "active", returns 400 error
4. Creates new user with status "invited", role "employee", and generates invite token
5. Sends invitation email with token link
6. Returns created user

**Response** (201 Created): `UserResponse`

**Invite Token**:
- 32-byte URL-safe random token
- SHA256 hash stored in database
- Expires after 7 days (configurable via `INVITE_TOKEN_EXPIRE_DAYS`)
- Invite URL format: `{FRONTEND_BASE_URL}/accept-invite?token={raw_token}`

#### PATCH /users/{id}/role

**Authentication**: Requires `users:update_role` permission (owner/admin only)

**Request**:
```json
{
  "role": "recruiter"
}
```

**Validation**:
- Target user must exist in same organization
- Target user cannot be owner (returns 403)
- Role must be valid enum value

**Response** (200 OK): `UserResponse`

#### DELETE /users/{id}

**Authentication**: Requires `users:remove` permission (owner/admin only)

**Validation**:
- Target user must exist in same organization
- Target user cannot be owner (returns 403)

**Response**: 204 No Content

### Protection Rules

1. **Owner Protection**: Owner role cannot be modified or deleted via API
2. **Admin Protection**: Only owner can modify/remove admin roles (enforced at permission level)
3. **Self-Modification**: Users cannot change their own role or remove themselves (enforced in frontend UI)
4. **Multi-Tenancy**: All operations scoped to authenticated user's organization

### Email Service

**Location**: `apps/backend/app/services/email.py`

**Function**: `send_invite_email(to_email, invite_url, org_name, inviter_name)`

**Template**: `apps/backend/app/email_templates/invite.html`

**Content**:
- Personalized greeting with inviter name
- Organization name
- Call-to-action button with invite URL
- Expiry notice (7 days)

## Database Schema

### User Model Updates

**Location**: `apps/backend/app/models/user.py`

**Invite-related fields**:
- `invite_token_hash`: SHA256 hash of invite token (nullable)
- `invite_token_expires_at`: Token expiry timestamp (nullable)
- `status`: Enum (invited, active, disabled)

### Migration

**File**: `apps/backend/alembic/versions/c3d4e5f6a7b8_add_invite_token_fields.py`

**Changes**:
- Added `invite_token_hash` column
- Added `invite_token_expires_at` column
- Added `status` column with default "active"

## Role Hierarchy

**Assignable Roles** (via API):
- admin
- recruiter
- hiring_manager
- interviewer
- employee

**Protected Role**:
- owner (cannot be assigned, modified, or deleted via API)

## Permission Matrix

See `AUTHORIZATION & PERMISSIONS (V2 ATS Roles)` section for full permission matrix.

**Team Management Permissions**:
- `users:read` — View team members (owner/admin)
- `users:invite` — Invite new users (owner/admin)
- `users:update_role` — Change user roles (owner/admin)
- `users:remove` — Remove users (owner/admin)

## Security Considerations

1. **Token Security**: Invite tokens are hashed before storage (SHA256)
2. **Token Expiry**: Tokens expire after 7 days
3. **Email Validation**: Email format validated before sending invites
4. **Permission Enforcement**: Three-layer enforcement (middleware, provider, backend)
5. **Rate Limiting**: Invite endpoint protected by rate limiter (future enhancement)
6. **Cross-Org Protection**: All queries scoped to authenticated user's organization

## Frontend State Management

**No Mock Data**: All team member data fetched from backend API

**Loading States**:
- Initial load: Skeleton placeholders
- Permission denied: Shield icon with message
- Error state: Alert icon with retry button

**Real-time Updates**: After invite/update/delete, page refetches user list to show latest state

## Change Log

- 2026-02-19: Team Management fully implemented — frontend UI wired to backend API, invite system with email tokens, role management with owner/admin protection, permission-based access control

---

# WORKSPACE SETTINGS (Organization Profile)

## Overview

Workspace Settings allows users to update their organization's profile information including name and website. Changes are persisted to the database and immediately reflected across the application via session refresh.

## Database Schema

**Table**: `organizations`

**Columns**:
- `id`: UUID (primary key)
- `name`: String (required) — Organization display name
- `website`: String (nullable) — Organization website URL
- `created_at`: Timestamp
- `updated_at`: Timestamp (auto-updated on changes)

**Migration**: `g2h3i4j5k6l7_add_organization_website.py`
- Added `website` column as nullable string

## Backend Implementation

**Endpoint**: `PATCH /organizations/me`

**Location**: `apps/backend/app/api/v1/endpoints/organizations.py`

**Authentication**: Requires `require_active_user` (verified + onboarded user)

**Request Body**:
```json
{
  "name": "Acme Inc",
  "website": "https://acme.com"
}
```

**Validation**:
- `name`: Required, 1-255 characters
- `website`: Optional, can be null or empty string

**Process**:
1. Extracts `org_id` from authenticated user's JWT
2. Fetches organization by `org_id`
3. Updates `name` and `website` fields
4. Commits to database
5. Returns updated organization

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "Acme Inc",
  "website": "https://acme.com"
}
```

**Multi-Tenancy**: Organization is identified solely by `current_user.org_id` from JWT. No `org_id` accepted in request body.

## Frontend Implementation

**Location**: `apps/web/src/app/(app-page-wrapper)/settings/workspace/page.tsx`

### Data Source

Organization data comes from the authenticated user's session:
- `user.org_name` — Workspace name (set during onboarding)
- `user.org_website` — Website URL (nullable)

Session data is fetched via `useAuthSession()` provider hook.

### Form Behavior

**Initial State**:
- Workspace Name: Populated from `user.org_name`
- Website: Populated from `user.org_website` (empty if null)
- Save button: Disabled

**Dirty Tracking**:
- Form tracks original values on mount
- Compares current input values to originals
- Save button enables only when values differ

**Save Button Rules**:
- Disabled when form is pristine (no changes)
- Disabled when workspace name is empty
- Disabled during API call (shows "Saving...")
- Enabled when form is dirty and name is valid

### Save Flow

1. User modifies workspace name or website
2. Save button becomes enabled
3. User clicks Save
4. Frontend calls `updateOrganization({ name, website })`
5. Backend updates `organizations` table
6. Frontend calls `refreshSession(true)` to reload user session
7. Session provider fetches updated data from `/auth/me`
8. UI reflects new values immediately
9. Success toast displayed
10. Form becomes pristine again (Save button disabled)

### Session Refresh

**Why Refresh**: Organization name is included in the user session response (`/auth/me`). After updating the organization, the session must be refreshed to reflect the new name globally across the application.

**Implementation**:
```typescript
await refreshSession(true);
```

The `force` parameter bypasses any in-flight request caching and ensures fresh data is fetched.

**Effect**: Updated organization name appears in:
- Workspace Settings page
- Navigation/header (if displayed)
- Any other component using `user.org_name`

### Error Handling

- **403 Forbidden**: User lacks permission (should not occur with `require_active_user`)
- **422 Unprocessable Entity**: Validation error (e.g., name too short)
- **429 Too Many Requests**: Rate limit exceeded (uses existing `handle429Error` formatting)
- **Generic Error**: Displays error message from API response

All errors shown via toast notification.

## Auth Session Updates

**Endpoint**: `GET /auth/me`

**Updated Response**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "owner",
  "org_id": "uuid",
  "org_name": "Acme Inc",
  "org_website": "https://acme.com",
  "is_verified": true,
  "is_onboarded": true
}
```

**Changes**:
- Added `org_name` field (string)
- Added `org_website` field (nullable string)

**Implementation**: `/auth/me` now performs a JOIN to fetch organization data and includes it in the response.

## API Client

**Location**: `apps/web/src/lib/api.ts`

**New Function**:
```typescript
export function updateOrganization(data: {
  name: string;
  website: string | null;
}): Promise<OrganizationResponse>
```

**Type Definitions**:
```typescript
export type OrganizationResponse = {
  id: string;
  name: string;
  website: string | null;
};

export type AuthSessionResponse = {
  // ... existing fields
  org_name: string;
  org_website: string | null;
};
```

## Security Considerations

1. **Authentication Required**: Endpoint protected by `require_active_user`
2. **Multi-Tenancy Enforced**: Organization identified by JWT `org_id`, not request body
3. **No Cross-Org Access**: Users can only update their own organization
4. **Input Validation**: Name length validated (1-255 chars)
5. **SQL Injection Prevention**: SQLAlchemy ORM used for all queries

## Change Log

- 2024-01-20: Workspace Settings implemented — added `website` column to organizations table, created `PATCH /organizations/me` endpoint, updated `/auth/me` to include org data, replaced hardcoded values in frontend with real session data, implemented dirty tracking and save functionality

---

# SUBDOMAIN ARCHITECTURE (Simplified)

## Overview

The application uses a deterministic subdomain system with automatic protocol detection. Configuration requires only two environment variables per environment.

## Environment Variables

### Frontend

**Development** (`apps/web/.env.local`):
```env
NEXT_PUBLIC_APP_SUBDOMAIN=app
NEXT_PUBLIC_APP_ROOT_HOST=localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Production**:
```env
NEXT_PUBLIC_APP_SUBDOMAIN=app
NEXT_PUBLIC_APP_ROOT_HOST=onehash.ai
NEXT_PUBLIC_API_URL=https://api.onehash.ai
```

**Staging**:
```env
NEXT_PUBLIC_APP_SUBDOMAIN=app
NEXT_PUBLIC_APP_ROOT_HOST=staging.onehash.ai
NEXT_PUBLIC_API_URL=https://api.staging.onehash.ai
```

### Backend

**Development** (`apps/backend/.env`):
```env
FRONTEND_BASE_URL=http://app.localhost:3000
COOKIE_DOMAIN=
CORS_ORIGINS=http://app.localhost:3000,http://localhost:3000
```

**Production**:
```env
FRONTEND_BASE_URL=https://app.onehash.ai
COOKIE_DOMAIN=.onehash.ai
CORS_ORIGINS=https://app.onehash.ai
```

**Staging**:
```env
FRONTEND_BASE_URL=https://app.staging.onehash.ai
COOKIE_DOMAIN=.staging.onehash.ai
CORS_ORIGINS=https://app.staging.onehash.ai
```

## App Base URL Construction

**Location**: `apps/web/src/lib/host.ts`

**Functions**:
- `getAppHost()` → Returns constructed host (e.g., `app.localhost:3000`)
- `getAppBaseUrl()` → Returns full URL with protocol (e.g., `http://app.localhost:3000`)

**Logic**:
```typescript
host = `${NEXT_PUBLIC_APP_SUBDOMAIN}.${NEXT_PUBLIC_APP_ROOT_HOST}`
protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https"
baseUrl = `${protocol}://${host}`
```

**Results**:
- Dev: `http://app.localhost:3000`
- Prod: `https://app.onehash.ai`
- Staging: `https://app.staging.onehash.ai`

**Protocol Detection**:
- Automatic based on host content
- No `NEXT_PUBLIC_APP_PROTOCOL` variable needed
- Localhost/127.0.0.1 → `http`
- Everything else → `https`

## Cookie Domain Behavior

**Backend**: `apps/backend/app/api/v1/endpoints/auth.py`

**Logic**:
```python
if settings.cookie_domain:
    cookie_params["domain"] = settings.cookie_domain
# else: no domain parameter (scoped to exact host)
```

**Development** (`COOKIE_DOMAIN=""`):
- Cookie set without `domain` parameter
- Scoped to `app.localhost:3000` exactly
- Works without cross-subdomain issues

**Production** (`COOKIE_DOMAIN=".onehash.ai"`):
- Cookie set with `domain=.onehash.ai`
- Shared across all `*.onehash.ai` subdomains
- Enables SSO across app/api/etc.

**Staging** (`COOKIE_DOMAIN=".staging.onehash.ai"`):
- Cookie set with `domain=.staging.onehash.ai`
- Isolated from production cookies

## Subdomain Redirect

**Middleware**: `apps/web/src/middleware.ts`

Automatically redirects:
- `localhost:3000` → `app.localhost:3000`
- `localhost:3000/jobs` → `app.localhost:3000/jobs`

Preserves path and query parameters.

## Post-Auth Redirect Flow

All authentication flows redirect to `/dashboard`:

1. **Login success** → `/dashboard`
2. **Signup** → `/verify` (middleware enforces)
3. **Email verified** → `/onboarding` (provider enforces)
4. **Onboarding complete** → `/dashboard` (provider enforces)

**Implementation**:
- Middleware: Redirects authenticated users on auth routes to `/dashboard`
- Provider: Redirects fully onboarded users on lifecycle routes to `/dashboard`
- All redirects use relative paths (no absolute URLs)

## CORS Configuration

**Backend**: Supports multiple origins for local development:
```env
CORS_ORIGINS=http://app.localhost:3000,http://localhost:3000
```

**Rules**:
- No wildcards allowed
- Exact origin matching
- Credentials enabled
- Multiple origins comma-separated

## Docker Compose

**Web Service**:
```yaml
environment:
  NEXT_PUBLIC_APP_SUBDOMAIN: app
  NEXT_PUBLIC_APP_ROOT_HOST: localhost:3000
  NEXT_PUBLIC_API_URL: http://localhost:8000
```

**Backend Service**:
```yaml
environment:
  FRONTEND_BASE_URL: http://app.localhost:3000
  COOKIE_DOMAIN: ""
  CORS_ORIGINS: http://app.localhost:3000,http://localhost:3000
```

## Testing Locally

1. Start services: `docker-compose up --build`
2. Access: `http://app.localhost:3000`
3. Signup → redirects to `/verify`
4. Verify email → redirects to `/onboarding`
5. Complete onboarding → redirects to `/dashboard`
6. Logout → redirects to `/login`
7. Login → redirects to `/dashboard`
8. Check cookies in DevTools under `app.localhost`

**Note**: Modern browsers support `.localhost` subdomains without `/etc/hosts` modification.

## Removed Variables

❌ `NEXT_PUBLIC_ROOT_DOMAIN` (replaced by `NEXT_PUBLIC_APP_ROOT_HOST`)
❌ `NEXT_PUBLIC_APP_PROTOCOL` (auto-detected)
❌ Any other subdomain-related variables from previous implementations

## Change Log

- 2024-01-20: Subdomain architecture simplified — replaced confusing multi-variable setup with deterministic two-variable system, added automatic protocol detection, standardized all post-auth redirects to `/dashboard`, updated all environment files and documentation

---

# NEXT.JS API PROXY PATTERN (Cookie Authentication Fix)

## Problem

When using subdomain architecture (`app.localhost:3000` for frontend, `localhost:8000` for backend), browsers reject cookies with `domain=.localhost` or `domain=localhost`, causing authentication failures across subdomains.

## Solution

Use Next.js API proxy to keep frontend and backend on the same origin, eliminating cross-subdomain cookie issues while maintaining subdomain architecture in the URL.

## Implementation

### Next.js Configuration

**Location**: `apps/web/next.config.js`

```javascript
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_INTERNAL_URL}/:path*`,
      },
    ];
  },
};
```

**How It Works**:
- All requests to `/api/*` are proxied to the backend
- Browser sees requests going to `app.localhost:3000/api/*`
- Next.js server forwards them to `localhost:8000/*`
- Cookies are scoped to `app.localhost:3000` (no domain parameter needed)

### Environment Variables

**Frontend** (`apps/web/.env.local`):
```env
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_APP_SUBDOMAIN=app
NEXT_PUBLIC_APP_ROOT_HOST=localhost:3000
```

**Docker Compose** (`docker-compose.yml`):
```yaml
web:
  environment:
    NEXT_PUBLIC_API_URL: /api
    API_INTERNAL_URL: http://backend:8000
```

**Key Points**:
- `NEXT_PUBLIC_API_URL=/api` — Client-side API calls go to relative `/api` path
- `API_INTERNAL_URL=http://backend:8000` — Server-side proxy target (Docker service name)

### Middleware Exclusion

**Location**: `apps/web/src/middleware.ts`

```typescript
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
```

**Why**: Middleware must not process `/api/*` routes, as they are handled by Next.js rewrites.

### Backend Cookie Configuration

**Location**: `apps/backend/app/api/v1/endpoints/auth.py`

```python
def _set_access_cookie(response: Response, token: str) -> None:
    cookie_params = {
        "key": "access_token",
        "value": token,
        "httponly": True,
        "samesite": "lax",
        "secure": settings.is_production,
    }
    if settings.cookie_domain:
        cookie_params["domain"] = settings.cookie_domain
    response.set_cookie(**cookie_params)
```

**Development** (`COOKIE_DOMAIN=""`):
- No `domain` parameter set
- Cookie scoped to exact host (`app.localhost:3000`)
- Works perfectly with Next.js proxy

**Production** (`COOKIE_DOMAIN=".onehash.ai"`):
- Cookie shared across `*.onehash.ai` subdomains
- Enables SSO across app/api/etc.

## Request Flow

### Development (with proxy)

```
Browser → app.localhost:3000/api/auth/login
         ↓ (Next.js rewrite)
Next.js → localhost:8000/auth/login
         ↓ (FastAPI response with cookie)
Browser ← Set-Cookie: access_token=...; Path=/; HttpOnly; SameSite=lax
         (cookie scoped to app.localhost:3000)
```

### Subsequent Requests

```
Browser → app.localhost:3000/api/auth/me
         (includes cookie automatically)
         ↓ (Next.js rewrite)
Next.js → localhost:8000/auth/me
         (forwards cookie in headers)
         ↓ (FastAPI validates JWT)
Browser ← 200 OK with user data
```

## Benefits

1. **Same-Origin**: Frontend and backend appear to be on the same origin to the browser
2. **No CORS Issues**: All requests are same-origin from browser perspective
3. **Cookie Simplicity**: No `domain` parameter needed in development
4. **Subdomain Architecture Preserved**: URL still shows `app.localhost:3000`
5. **Production Ready**: Works identically in production with proper `COOKIE_DOMAIN`

## Testing

1. Start services: `docker-compose up --build`
2. Open: `http://app.localhost:3000`
3. Login with credentials
4. Check DevTools → Application → Cookies → `app.localhost`
5. Verify `access_token` cookie is present
6. Navigate to `/dashboard` (should work without redirect to `/login`)
7. Check Network tab → `/api/auth/me` should return 200 OK

## Comparison: Before vs After

### Before (Cross-Subdomain Cookies)

❌ Frontend: `app.localhost:3000`  
❌ Backend: `localhost:8000`  
❌ Cookie domain: `.localhost` (rejected by browser)  
❌ Result: Authentication fails, infinite redirect loops

### After (Next.js Proxy)

✅ Frontend: `app.localhost:3000`  
✅ Backend: `localhost:8000` (internal)  
✅ API calls: `app.localhost:3000/api/*` (proxied)  
✅ Cookie domain: none (scoped to `app.localhost:3000`)  
✅ Result: Authentication works perfectly

## Production Deployment

**Frontend** (Cloudflare/Vercel):
```env
NEXT_PUBLIC_API_URL=/api
API_INTERNAL_URL=http://internal-backend-service:8000
```

**Backend** (ECS/EC2):
```env
COOKIE_DOMAIN=.onehash.ai
CORS_ORIGINS=https://app.onehash.ai
```

**Infrastructure**:
- Frontend at `app.onehash.ai`
- Backend at `api.onehash.ai` (internal)
- Next.js proxy handles `/api/*` → internal backend
- Cookies shared across `*.onehash.ai` via `COOKIE_DOMAIN`

## Change Log

- 2024-01-20: Next.js API proxy pattern implemented — replaced cross-subdomain cookie approach with same-origin proxy, updated `next.config.js` with rewrite rules, modified middleware matcher to exclude `/api/*`, updated environment variables for proxy configuration, tested and confirmed authentication working on `app.localhost:3000`

