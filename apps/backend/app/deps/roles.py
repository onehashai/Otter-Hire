from fastapi import Depends, HTTPException, status

from app.deps.auth import require_active_user
from app.models.user import User


def require_role(allowed_roles: list[str]):
    async def _dependency(current_user: User = Depends(require_active_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _dependency
