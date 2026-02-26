from app.email_templates import EmailContent


def build_invite_email(
    invite_url: str,
    org_name: str,
    inviter_name: str,
    expiry_days: int,
) -> EmailContent:
    return EmailContent(
        subject=f"You've been invited to join {org_name} on OneHash ATS",
        html=f"""
    <html>
        <body>
            <h2>You're invited!</h2>
            <p>
                <strong>{inviter_name}</strong> has invited you to join
                <strong>{org_name}</strong> on OneHash ATS.
            </p>
            <p>Click the link below to set up your account:</p>
            <p><a href="{invite_url}">Accept Invitation</a></p>
            <p>This link will expire in {expiry_days} days.</p>
            <p>If you weren't expecting this invitation, please ignore this email.</p>
        </body>
    </html>
    """,
        text=f"""
    You're invited!

    {inviter_name} has invited you to join {org_name} on OneHash ATS.

    Accept your invitation by visiting:
    {invite_url}

    This link will expire in {expiry_days} days.

    If you weren't expecting this invitation, please ignore this email.
    """,
    )
