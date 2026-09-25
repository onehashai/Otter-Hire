from types import SimpleNamespace

from app.core.permissions import has_permission


def test_candidate_update_permission_is_granted_only_to_editing_roles():
    assert has_permission(SimpleNamespace(membership_role="owner"), "candidates:update")
    assert has_permission(SimpleNamespace(membership_role="admin"), "candidates:update")
    assert has_permission(SimpleNamespace(membership_role="recruiter"), "candidates:update")

    for role in ("hiring_manager", "interviewer", "employee"):
        assert not has_permission(SimpleNamespace(membership_role=role), "candidates:update")
