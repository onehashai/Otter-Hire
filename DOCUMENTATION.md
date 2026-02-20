# OneHash ATS – System Documentation

This document describes the actual implementation of three core systems in the OneHash ATS application: Frontend-Backend Communication, Authentication, and the Email Verification + Onboarding Lifecycle.

---

## 1. Frontend ↔ Backend Communication

### Architecture

The frontend (Next.js 14) communicates with the backend (FastAPI) via HTTP requests with cookie-based authentication.

### API Client Configuration

**Location**: `apps/web/src/api/` (client in `client.ts`; auth in `auth.ts`; invites in `invites.ts`; re-exports in `index.ts`)

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

<!-- Future changes will be documented here -->
