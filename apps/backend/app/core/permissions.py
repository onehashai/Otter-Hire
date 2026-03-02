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
    "org:inbox:manage",
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
        "jobs:delete",
        "jobs:publish",
        "jobs:close",
        "jobs:unpublish",
        "org:inbox:manage",
    },
    "recruiter": {
        "jobs:read",
        "jobs:create",
        "jobs:update",
        "jobs:delete",
        "jobs:publish",
        "jobs:close",
        "jobs:unpublish",
        "org:inbox:manage",
    },
    "hiring_manager": {
        "jobs:read",
    },
    "interviewer": {
        "jobs:read",
    },
    "employee": {
        "jobs:read",
    },
}


def has_permission(user: User, perm: str) -> bool:
    role_perms = ROLE_PERMISSIONS.get(user.role, set())
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
