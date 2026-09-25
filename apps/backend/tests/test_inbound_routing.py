from app.integrations.app_store.email_integration.inbound_routing import (
    ONEHASH_CAREERS_INBOX_ADDRESS,
    ONEHASH_ORGANIZATION_ID,
    is_onehash_careers_inbox,
)


def test_legacy_onehash_careers_address_is_normalized():
    assert is_onehash_careers_inbox(" Careers@OneHash.AI ")
    assert not is_onehash_careers_inbox("careers@example.com")
    assert ONEHASH_CAREERS_INBOX_ADDRESS == "careers@onehash.ai"
    assert str(ONEHASH_ORGANIZATION_ID) == "01a05b4c-8fcf-74e0-9cc0-253cc4e24095"
