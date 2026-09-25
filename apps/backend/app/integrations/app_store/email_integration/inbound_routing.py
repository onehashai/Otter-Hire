from uuid import UUID

# careers@onehash.ai predates the generated org-<id>@applications.otter.bz inboxes.
# Keep it routed to the active production OneHash organization until the legacy
# forwarding rule is retired.
ONEHASH_CAREERS_INBOX_ADDRESS = "careers@onehash.ai"
ONEHASH_ORGANIZATION_ID = UUID("01a05b4c-8fcf-74e0-9cc0-253cc4e24095")


def is_onehash_careers_inbox(inbox_address: str | None) -> bool:
    return (inbox_address or "").strip().lower() == ONEHASH_CAREERS_INBOX_ADDRESS
