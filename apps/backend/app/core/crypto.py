"""
Encryption and hashing utilities for sensitive fields.

- encrypt_value / decrypt_value: Fernet symmetric encryption (confidentiality at rest)
- hmac_hash: deterministic HMAC-SHA256 hex digest (used as DB lookup key for encrypted fields)

Usage pattern for searchable encrypted columns (e.g. google_id):
  - Store encrypt_value(plaintext, key) in the primary column
  - Store hmac_hash(plaintext, key) in a companion *_hash column
  - Query using WHERE hash_col = hmac_hash(plaintext, key)

Usage pattern for non-searchable encrypted columns (e.g. encrypted_credentials):
  - Store encrypt_value(plaintext, key) on write
  - Call decrypt_value(token, key) on read
"""

import hashlib
import hmac as _hmac

from cryptography.fernet import Fernet, InvalidToken


def _fernet(key: str) -> Fernet:
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(plaintext: str, key: str) -> str:
    """Fernet-encrypt *plaintext* and return the base64url token string."""
    return _fernet(key).encrypt(plaintext.encode()).decode()


def decrypt_value(token: str, key: str) -> str:
    """Fernet-decrypt *token* and return the original plaintext string.

    Raises ``cryptography.fernet.InvalidToken`` if the token is corrupted or
    was encrypted with a different key.
    """
    return _fernet(key).decrypt(token.encode()).decode()


def hmac_hash(value: str, key: str) -> str:
    """Return a deterministic HMAC-SHA256 hex digest of *value*.

    The result is always 64 lowercase hex characters, suitable for use as a
    DB lookup key or uniqueness constraint alongside an encrypted column.
    """
    return _hmac.new(key.encode(), value.encode(), hashlib.sha256).hexdigest()


__all__ = ["encrypt_value", "decrypt_value", "hmac_hash", "InvalidToken"]
