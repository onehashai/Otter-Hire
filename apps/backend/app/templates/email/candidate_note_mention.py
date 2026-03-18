from app.templates import EmailContent


def build_candidate_note_mention_email(
    *,
    recipient_name: str,
    author_name: str,
    candidate_name: str,
    candidate_url: str,
    note_excerpt: str,
) -> EmailContent:
    safe_recipient = recipient_name or "there"
    return EmailContent(
        subject=f"{author_name} tagged you on {candidate_name}",
        html=f"""
    <html>
        <body>
            <h2>You were tagged in a candidate note</h2>
            <p>Hi {safe_recipient},</p>
            <p>
                <strong>{author_name}</strong> tagged you in a note for candidate
                <strong>{candidate_name}</strong>.
            </p>
            <p><strong>Note:</strong></p>
            <blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #d4d4d8;">
                {note_excerpt}
            </blockquote>
            <p style="margin-top: 16px;">
                <a href="{candidate_url}">Open Candidate</a>
            </p>
        </body>
    </html>
    """,
        text=f"""
    Hi {safe_recipient},

    {author_name} tagged you in a note for candidate {candidate_name}.

    Note:
    {note_excerpt}

    Open candidate:
    {candidate_url}
    """,
    )
