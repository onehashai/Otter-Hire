from fastapi import FastAPI
from sqladmin import Admin
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from app.core.config import settings
from app.db.session import engine


class _AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username", "")
        password = form.get("password", "")
        if username == settings.sqladmin_username and password == settings.sqladmin_password:
            request.session.update({"admin_authenticated": True})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return bool(request.session.get("admin_authenticated"))


def setup_admin(app: FastAPI) -> Admin:
    from app.admin.views import (
        ActivityAdmin,
        AutomationAdmin,
        AutomationExecutionAdmin,
        CandidateAdmin,
        CandidateDocumentAdmin,
        CandidateJobsAdmin,
        ConversationAdmin,
        FeedbackAdmin,
        InboundEmailAdmin,
        IntegrationAdmin,
        IntegrationCredentialAdmin,
        InterviewAdmin,
        JobAdmin,
        JobApplicationAdmin,
        JobCategoryAdmin,
        JobTeamMemberAdmin,
        MessageAdmin,
        NoteAdmin,
        OrganizationAdmin,
        OrgMembershipAdmin,
        StageAdmin,
        TemplateAdmin,
        UserAdmin,
    )

    authentication_backend = _AdminAuth(secret_key=settings.sqladmin_secret_key)
    admin = Admin(
        app,
        engine=engine,
        authentication_backend=authentication_backend,
        title=f"{settings.platform_name} Admin",
    )

    admin.add_view(UserAdmin)
    admin.add_view(OrganizationAdmin)
    admin.add_view(OrgMembershipAdmin)
    admin.add_view(IntegrationAdmin)
    admin.add_view(IntegrationCredentialAdmin)
    admin.add_view(JobAdmin)
    admin.add_view(JobCategoryAdmin)
    admin.add_view(JobTeamMemberAdmin)
    admin.add_view(StageAdmin)
    admin.add_view(CandidateAdmin)
    admin.add_view(CandidateJobsAdmin)
    admin.add_view(CandidateDocumentAdmin)
    admin.add_view(JobApplicationAdmin)
    admin.add_view(ConversationAdmin)
    admin.add_view(MessageAdmin)
    admin.add_view(InboundEmailAdmin)
    admin.add_view(TemplateAdmin)
    admin.add_view(InterviewAdmin)
    admin.add_view(FeedbackAdmin)
    admin.add_view(NoteAdmin)
    admin.add_view(ActivityAdmin)
    admin.add_view(AutomationAdmin)
    admin.add_view(AutomationExecutionAdmin)

    return admin
