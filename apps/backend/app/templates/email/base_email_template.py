"""
Shared HTML shell and inline styles for product (transactional) emails sent by the API.
"""

from __future__ import annotations

import html

from app.core.config import settings


def base_email_template(inner_html: str) -> str:
    """Wrap inner body HTML in the standard product email layout."""
    name = (settings.platform_name or "").strip() or "OneHash ATS"
    name_esc = html.escape(name, quote=False)
    logo_letter = name[0].upper() if name else "A"
    logo_letter_esc = html.escape(logo_letter, quote=False)
    return f"""<!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin:0;padding:0;">
                <div style="background-color:#f7f7f7;font-family:'Inter',Arial,Helvetica,sans-serif;margin:0;padding:40px 0">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:520px;width:100%"><tbody>
                <tr>
                <td style="padding:0 24px 24px;text-align:center">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
                <td style="vertical-align:middle;padding-right:10px">
                <div style="height:32px;width:32px;border-radius:8px;background-color:#0d0d0d;display:inline-block;text-align:center;line-height:32px">
                <span style="color:#ffffff;font-size:13px;font-weight:700">{logo_letter_esc}</span>
                </div>
                </td>
                <td style="vertical-align:middle">
                <span style="font-size:16px;font-weight:600;color:#0d0d0d;letter-spacing:-0.01em">{name_esc}</span>
                </td>
                </tr></table>
                </td>
                </tr>
                <tr>
                <td>
                <div style="background-color:#ffffff;border-radius:12px;border:1px solid #e8e8e8;padding:40px 32px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                {inner_html}
                </div>
                </td>
                </tr>
                <tr>
                <td style="padding:24px 24px 0;text-align:center">
                <p style="font-size:12px;color:#bbbbbb;line-height:1.5;margin:4px 0 0">If you have questions, contact {settings.support_email}</p>
                </td>
                </tr>
                </tbody></table>
                </div>
                </body>
                </html>
            """


STYLE_HEADING = (
    "font-size:22px;font-weight:600;color:#0d0d0d;margin:0 0 12px;"
    "letter-spacing:-0.02em;line-height:1.3"
)
STYLE_TEXT = "font-size:14px;color:#555555;line-height:1.7;margin:0 0 24px"
STYLE_TEXT_SMALL = "font-size:13px;color:#777777;line-height:1.6;margin:0 0 20px"
STYLE_BUTTON = (
    "display:inline-block;background-color:#0d0d0d;color:#ffffff;font-size:14px;font-weight:500;"
    "padding:12px 28px;border-radius:8px;text-decoration:none;text-align:center;width:100%;"
    "box-sizing:border-box"
)
STYLE_LINK_LINE = (
    "font-size:12px;color:#999999;line-height:1.5;word-break:break-all;margin:16px 0 0"
)
STYLE_COPY_PASTE_HINT = "font-size:13px;color:#777777;line-height:1.6;margin:16px 0 4px"
STYLE_LINK_LINE_TIGHT = "font-size:12px;color:#999999;line-height:1.5;word-break:break-all;margin:0"
STYLE_DIVIDER = "height:1px;background-color:#f0f0f0;border:none;margin:24px 0"


def esc(s: str) -> str:
    return html.escape(s, quote=False)


def esc_attr(s: str) -> str:
    return html.escape(s, quote=True)


def block_button(href: str, label: str) -> str:
    return f'<a href="{esc_attr(href)}" style="{STYLE_BUTTON}">{esc(label)}</a>'


def url_as_text(url: str) -> str:
    return f'<p style="{STYLE_LINK_LINE}">{esc(url)}</p>'


def copy_paste_link_block(url: str) -> str:
    return (
        f'<p style="{STYLE_COPY_PASTE_HINT}">Or copy and paste this link:</p>'
        f'<p style="{STYLE_LINK_LINE_TIGHT}">{esc(url)}</p>'
    )


def hr() -> str:
    return f'<hr style="{STYLE_DIVIDER}" />'
