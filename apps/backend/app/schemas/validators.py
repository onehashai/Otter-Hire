import re

from pydantic import EmailStr, TypeAdapter

PHONE_ALLOWED_CHARS_RE = re.compile(r"^[+\d()\-\s.]+$")
EMAIL_ADAPTER = TypeAdapter(EmailStr)


def normalize_email(value: EmailStr | str) -> str:
    return str(value).strip().lower()


def is_valid_email(value: str) -> bool:
    try:
        EMAIL_ADAPTER.validate_python(value.strip())
        return True
    except Exception:
        return False


def normalize_phone(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def is_valid_phone(value: str) -> bool:
    normalized = value.strip()
    if not normalized:
        return False
    if not PHONE_ALLOWED_CHARS_RE.fullmatch(normalized):
        return False
    digits = "".join(ch for ch in normalized if ch.isdigit())
    return 7 <= len(digits) <= 15
