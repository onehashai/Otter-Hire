"""Parse email body into visible (main) and quoted parts using mail-parser-reply."""

from __future__ import annotations

# Languages for reply header detection (English + common variants)
_DEFAULT_LANGUAGES = ["en", "de", "fr", "es", "nl", "it"]


def parse_email_body(body: str) -> tuple[str, str | None]:
    """Split email body into visible (main) text and quoted section.

    Uses mail-parser-reply for multi-language reply/signature detection.
    Returns (body_visible, body_quoted).
    """
    if not body or not body.strip():
        return ("", None)

    text = body.strip()
    try:
        from mailparser_reply import EmailReplyParser

        parser = EmailReplyParser(languages=_DEFAULT_LANGUAGES)
        visible = parser.parse_reply(text=text)
        visible = (visible or "").strip()

        mail_message = parser.read(text=text)
        replies = getattr(mail_message, "replies", []) or []
        # replies[0] = new reply (top), replies[1:] = quoted blocks (bottom)
        if len(replies) > 1:
            quoted_parts = [r.content for r in replies[1:] if getattr(r, "content", None)]
            quoted = "\n\n".join(quoted_parts).strip() if quoted_parts else None
        else:
            quoted = None

        return (visible or text, quoted)
    except Exception:
        return (text, None)
