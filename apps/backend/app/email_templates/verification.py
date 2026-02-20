from app.email_templates import EmailContent


def build_verification_email(verify_url: str, expiry_hours: int) -> EmailContent:
    return EmailContent(
        subject="Verify your OneHash ATS account",
        html=f"""
    <html>
        <body>
            <h2>Welcome to OneHash ATS!</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="{verify_url}">Verify Email</a></p>
            <p>This link will expire in {expiry_hours} hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
        </body>
    </html>
    """,
        text=f"""
    Welcome to OneHash ATS!

    Please verify your email address by visiting:
    {verify_url}

    This link will expire in {expiry_hours} hours.

    If you didn't create an account, please ignore this email.
    """,
    )
