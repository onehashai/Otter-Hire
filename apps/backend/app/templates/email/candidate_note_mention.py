from app.templates import EmailContent
from app.templates.email.base_email_template import (
    STYLE_HEADING,
    STYLE_TEXT,
    base_email_template,
    block_button,
    esc,
)


def build_candidate_note_mention_email(
    *,
    recipient_name: str,
    author_name: str,
    candidate_name: str,
    candidate_url: str,
    note_excerpt: str,
) -> EmailContent:
    safe_recipient = recipient_name or "there"
    excerpt_block = (
        f'<p style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #e8e8e8;'
        f'background-color:#fafafa;font-size:14px;color:#555555;line-height:1.6;'
        f'white-space:pre-wrap">{esc(note_excerpt)}</p>'
    )
    inner = f"""
                <h1 style="{STYLE_HEADING}">You were tagged in a candidate note</h1>
                <p style="{STYLE_TEXT}">Hi {esc(safe_recipient)},</p>
                <p style="{STYLE_TEXT}">
                <strong>{esc(author_name)}</strong> tagged you in a note for candidate
                <strong>{esc(candidate_name)}</strong>.
                </p>
                <p style="{STYLE_TEXT}"><strong>Note</strong></p>
                {excerpt_block}
                {block_button(candidate_url, "Open candidate")}
            """
    html_body = base_email_template(inner)
    return EmailContent(
        subject=f"{author_name} tagged you on {candidate_name}",
        html=html_body,
        text=f"""
            Hi {safe_recipient},

            {author_name} tagged you in a note for candidate {candidate_name}.

            Note:
            {note_excerpt}

            Open candidate:
            {candidate_url}
            """,
        )
