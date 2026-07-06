# Security Hardening Plan for Smart Agriculture Data Platform

## Current Problems
- Sequential integer IDs exposed in URLs (`/lands/1`, `/lands/2`...)
- No ownership checks on many endpoints (anyone can guess IDs)
- Some routes return data without proper authz
- Glassmorphism / transparent elements (already being addressed)
- Missing rate limiting, security headers, audit for security events
- Frontend also leaks IDs in navigation and state

## Goals
- Hide IDs using public UUIDs
- Enforce authentication + ownership on every resource
- Centralize security logic so it is easy to reuse ("inherit")
- Apply industry-standard protections across backend + frontend
- Keep internal integer IDs for DB performance

## Phased Implementation Plan

### Phase 1: ID Protection (Highest Priority)
- Add `public_id` (UUID) column to `Land` model + other exposed resources
- Generate on creation
- Change **all** public routes from `{land_id: int}` to `{public_id: str}`
- Update services/repositories with `get_by_public_id()`
- Update frontend routing and all `navigate()` / links to use public IDs
- Return only `public_id` in list responses where possible

### Phase 2: Authorization Layer
- Every land-related endpoint must verify ownership
- Admin-only routes protected by role
- Use consistent "404 instead of 403" for non-owned resources (prevents enumeration)

### Phase 3: Centralized Security Module (see `app/security/`)
- All security features in one place
- Easy to import and apply

### Phase 4: Additional Hardening
- Rate limiting (auth endpoints + general API)
- Security response headers (CSP, HSTS, etc.)
- Strict CORS
- Better error handling (never leak stack traces or internal IDs)
- Audit logging for sensitive actions (access denied, role escalation attempts)
- Frontend protections (sanitization, route guards, no secrets in URLs)
- Consider short-lived tokens + refresh rotation

### Phase 5: Operational
- Enable HTTPS everywhere
- Secrets in env / vault
- Dependency scanning + SAST in CI
- Security headers tests

## Simple Project Structure

```
services/backend/app/
├── security/                    # ← NEW centralized security package
│   ├── __init__.py              # Exports everything for easy import
│   ├── auth.py                  # JWT creation / verification + user dependencies
│   ├── permissions.py           # Ownership checks, role-based access
│   ├── public_ids.py            # UUID generation + lookup helpers
│   ├── middleware.py            # SecurityHeaders + RateLimiter
│   ├── audit.py                 # Security event logging
│   ├── exceptions.py            # Safe exceptions (404 instead of 403)
│   └── README.md
│
├── core/
│   ├── dependencies.py          # (can delegate to security/)
│   └── security.py              # (legacy password hashing - keep for now)
├── api/                         # All routes import from security/
├── models/                      # Add public_id fields
└── ...

services/frontend/web/src/
├── security/                    # Frontend security utilities
│   ├── index.js
│   ├── sanitizers.js
│   ├── routeProtection.js       # ProtectedRoute, useRequireAuth
│   └── idUtils.js               # Helpers for public IDs
└── ...
```

## How to Use the Security Folder

**Backend example:**
```python
from app.security import (
    get_current_user,
    require_land_access,
    generate_public_id,
    log_security_event,
)

@router.get("/lands/{public_id}")
def get_land_detail(
    public_id: str,
    land = Depends(require_land_access),   # ← enforces ownership
    current_user = Depends(get_current_user),
):
    log_security_event(db, current_user.user_id, "land_viewed", target_id=land.id)
    return land
```

**Frontend example:**
```js
import { useRequireAuth } from '../security';

function LandDetails() {
  useRequireAuth();
  // ...
}
```

## Immediate Next Steps (Recommended Order)

1. Create the `security/` folder (done in this change)
2. Add `public_id` (UUID) + migration to `Land` model
3. Update `lands/repository.py` + `service.py` with public_id helpers
4. Change `api/lands.py` routes + dependencies to use public_id + `require_land_access`
5. Update frontend:
   - React routes: `/lands/:publicId`
   - All `navigate()`, API calls, and state to use `public_id`
6. Add middleware in `main.py`
7. Apply `require_land_access` (or similar) to other modules (crops, soil, etc.)
8. Harden error responses and add security headers

This approach gives you both **hiding of IDs** and a clean place to grow all future security features.
