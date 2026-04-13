from fastapi import Depends, HTTPException, status

from app.deps.auth import require_active_user
from app.models.user import User

PERMISSIONS = {
    "users:read",
    "users:invite",
    "users:update_role",
    "users:remove",
    "jobs:read",
    "jobs:create",
    "jobs:update",
    "jobs:delete",
    "jobs:publish",
    "jobs:close",
    "jobs:unpublish",
    "candidates:read",
    "candidates:source",
    "candidates:stage_update",
    "candidates:feedback",
    "interviews:schedule",
    "interviews:feedback",
    "reports:read",
    "settings:system",
    "billing:manage",
    "org:inbox:manage",
    "templates:read",
    "templates:create",
    "templates:update",
    "templates:delete",
    "automations:read",
    "automations:create",
    "automations:update",
    "automations:delete",
}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "owner": set(PERMISSIONS),
    "admin": {
        "users:read",
        "users:invite",
        "users:update_role",
        "users:remove",
        "jobs:read",
        "jobs:create",
        "jobs:update",
        "jobs:delete",  # Admin/system-level moderation
        "jobs:publish",
        "jobs:close",
        "jobs:unpublish",
        "candidates:read",
        "candidates:source",
        "candidates:stage_update",
        "candidates:feedback",
        "interviews:schedule",
        "interviews:feedback",
        "reports:read",
        "settings:system",
        "org:inbox:manage",
        "templates:read",
        "templates:create",
        "templates:update",
        "templates:delete",
        "automations:read",
        "automations:create",
        "automations:update",
        "automations:delete",
    },
    "recruiter": {
        "jobs:read",
        "jobs:create",
        "jobs:update",
        "candidates:read",
        "candidates:source",
        "candidates:stage_update",
        "candidates:feedback",
        "interviews:schedule",
        "interviews:feedback",
        "templates:read",
        "templates:create",
        "templates:update",
        "templates:delete",
        "automations:read",
        "automations:create",
        "automations:update",
        "automations:delete",
    },
    "hiring_manager": {
        "jobs:read",
        "candidates:read",
        "candidates:stage_update",
        "candidates:feedback",
        "interviews:feedback",
    },
    "interviewer": {
        "candidates:read",
        "candidates:feedback",
        "interviews:feedback",
    },
    "employee": {
        "candidates:read",
        "reports:read",
    },
}


def has_permission(user: User, perm: str) -> bool:
    role_perms = ROLE_PERMISSIONS.get(user.membership_role, set())
    return perm in role_perms


def require_permission(perm: str):
    async def _dependency(current_user: User = Depends(require_active_user)) -> User:
        if not has_permission(current_user, perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _dependency
