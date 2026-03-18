from dataclasses import dataclass
from typing import Any
from app.utils.uuid import uuid7


@dataclass(frozen=True)
class ErrorPayload:
    code: str
    message: str
    details: Any
    request_id: str
    status_code: int

    def to_response_dict(self) -> dict[str, Any]:
        # Keep compatibility fields while moving to code/message contract.
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details,
            "request_id": self.request_id,
            "status_code": self.status_code,
            "error": self.message,
            "detail": self.message,
        }


def make_error_payload(
    status_code: int,
    code: str,
    message: str,
    details: Any = None,
    request_id: str | None = None,
) -> ErrorPayload:
    return ErrorPayload(
        code=code,
        message=message,
        details=details,
        request_id=request_id or str(uuid7()),
        status_code=status_code,
    )
