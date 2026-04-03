from typing import Any

from sqladmin import ModelView
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.automation import Automation, AutomationExecution
from app.models.candidate import Candidate
from app.models.candidate_jobs import CandidateJobs
from app.models.conversation import Conversation
from app.models.document import CandidateDocument
from app.models.email import InboundEmail
from app.models.feedback import Feedback
from app.models.integration import Integration
from app.models.integration_credential import IntegrationCredential
from app.models.interview import Interview
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.job_category import JobCategory
from app.models.job_team_member import JobTeamMember
from app.models.message import Message
from app.models.note import Note
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.stage import Stage
from app.models.template import Template
from app.models.user import User


class UserAdmin(ModelView, model=User):
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"

    column_list = [
        User.id,
        User.email,
        User.name,
        User.role,
        User.status,
        User.is_verified,
        User.created_at,
    ]
    column_searchable_list = [User.email, User.name]
    column_sortable_list = [User.email, User.name, User.role, User.status, User.created_at]
    column_default_sort = [(User.created_at, True)]

    form_excluded_columns = [
        User.hashed_password,
        User.verification_token_hash,
        User.verification_token_expires_at,
        User.invite_token_hash,
        User.invite_token_expires_at,
    ]
    column_details_exclude_list = [
        User.hashed_password,
        User.verification_token_hash,
        User.invite_token_hash,
    ]


class OrganizationAdmin(ModelView, model=Organization):
    name = "Organization"
    name_plural = "Organizations"
    icon = "fa-solid fa-building"

    column_list = [
        Organization.id,
        Organization.name,
        Organization.website,
        Organization.created_at,
    ]
    column_searchable_list = [Organization.name, Organization.website]
    column_sortable_list = [Organization.name, Organization.created_at]
    column_default_sort = [(Organization.created_at, True)]

    async def delete_model(self, request: Any, pk: str) -> None:
        """Override delete to handle cascade deletes."""
        print(f"\n=== delete_model called for org {pk} ===")

        # Get the organization first
        session: AsyncSession = self.session_maker()
        try:
            # Fetch the organization
            result = await session.execute(select(Organization).where(Organization.id == pk))
            org = result.scalar_one_or_none()
            if not org:
                print(f"Organization {pk} not found")
                return

            org_id = org.id
            print(f"Starting cascade delete for org {org_id}")

            # Delete in order to respect foreign key constraints
            print("Deleting activities...")
            await session.execute(delete(Activity).where(Activity.org_id == org_id))
            print("Deleting feedback...")
            await session.execute(delete(Feedback).where(Feedback.org_id == org_id))
            print("Deleting interviews...")
            await session.execute(delete(Interview).where(Interview.org_id == org_id))
            print("Deleting notes...")
            await session.execute(delete(Note).where(Note.org_id == org_id))
            print("Deleting messages...")
            await session.execute(delete(Message).where(Message.org_id == org_id))
            print("Deleting conversations...")
            await session.execute(delete(Conversation).where(Conversation.org_id == org_id))
            print("Deleting documents...")
            await session.execute(
                delete(CandidateDocument).where(CandidateDocument.org_id == org_id)
            )
            print("Deleting job applications...")
            await session.execute(delete(JobApplication).where(JobApplication.org_id == org_id))
            print("Deleting candidate jobs...")
            await session.execute(delete(CandidateJobs).where(CandidateJobs.org_id == org_id))

            # Delete inbound emails (attachments will cascade)
            print("Deleting inbound emails...")
            await session.execute(delete(InboundEmail).where(InboundEmail.org_id == org_id))

            # Delete candidates
            print("Deleting candidates...")
            await session.execute(delete(Candidate).where(Candidate.org_id == org_id))

            # Delete job-related records
            print("Deleting stages...")
            await session.execute(delete(Stage).where(Stage.org_id == org_id))
            print("Deleting job team members...")
            await session.execute(delete(JobTeamMember).where(JobTeamMember.org_id == org_id))
            print("Deleting jobs...")
            await session.execute(delete(Job).where(Job.org_id == org_id))
            print("Deleting job categories...")
            await session.execute(delete(JobCategory).where(JobCategory.org_id == org_id))

            # Delete templates and automations
            print("Deleting templates...")
            await session.execute(delete(Template).where(Template.org_id == org_id))
            print("Deleting automation executions...")
            await session.execute(
                delete(AutomationExecution).where(AutomationExecution.org_id == org_id)
            )
            print("Deleting automations...")
            await session.execute(delete(Automation).where(Automation.org_id == org_id))

            # Delete integrations and memberships
            print("Deleting integration credentials...")
            await session.execute(
                delete(IntegrationCredential).where(IntegrationCredential.org_id == org_id)
            )
            print("Deleting org memberships...")
            await session.execute(delete(OrgMembership).where(OrgMembership.org_id == org_id))

            # Delete or update users - set org_id to NULL for users in this org
            print("Updating users to remove org reference...")
            from sqlalchemy import update

            await session.execute(update(User).where(User.org_id == org_id).values(org_id=None))

            # Finally delete the organization itself
            print("Deleting organization...")
            await session.execute(delete(Organization).where(Organization.id == org_id))

            # Commit all deletes
            print("Committing all deletes...")
            await session.commit()
            print(f"Successfully deleted org {org_id} and all related data")
        except Exception as e:
            await session.rollback()
            print(f"\n!!! Error deleting organization {pk}: {e}")
            import traceback

            traceback.print_exc()
            raise
        finally:
            await session.close()
            print(f"=== delete_model completed for org {pk} ===\n")


class OrgMembershipAdmin(ModelView, model=OrgMembership):
    name = "Org Membership"
    name_plural = "Org Memberships"
    icon = "fa-solid fa-id-badge"

    column_list = [
        OrgMembership.id,
        OrgMembership.user_id,
        OrgMembership.org_id,
        OrgMembership.role,
        OrgMembership.status,
        OrgMembership.created_at,
    ]
    column_sortable_list = [OrgMembership.role, OrgMembership.status, OrgMembership.created_at]
    column_default_sort = [(OrgMembership.created_at, True)]

    form_excluded_columns = [OrgMembership.invite_token_hash, OrgMembership.invite_token_expires_at]
    column_details_exclude_list = [OrgMembership.invite_token_hash]


class IntegrationAdmin(ModelView, model=Integration):
    name = "Integration"
    name_plural = "Integrations"
    icon = "fa-solid fa-plug"

    column_list = [
        Integration.id,
        Integration.name,
        Integration.slug,
        Integration.category,
        Integration.is_active,
        Integration.created_at,
    ]
    column_searchable_list = [Integration.name, Integration.slug]
    column_sortable_list = [
        Integration.name,
        Integration.slug,
        Integration.category,
        Integration.is_active,
        Integration.created_at,
    ]
    column_default_sort = [(Integration.name, False)]
    column_details_exclude_list = []  # Explicitly exclude removed columns from details view


class IntegrationCredentialAdmin(ModelView, model=IntegrationCredential):
    name = "Integration Credential"
    name_plural = "Integration Credentials"
    icon = "fa-solid fa-key"

    column_list = [
        IntegrationCredential.id,
        IntegrationCredential.org_id,
        IntegrationCredential.integration_id,
        IntegrationCredential.status,
        IntegrationCredential.created_at,
    ]
    column_sortable_list = [
        IntegrationCredential.status,
        IntegrationCredential.created_at,
    ]
    column_default_sort = [(IntegrationCredential.created_at, True)]
    form_excluded_columns = [IntegrationCredential.encrypted_credentials]
    column_details_exclude_list = [IntegrationCredential.encrypted_credentials]


class JobAdmin(ModelView, model=Job):
    name = "Job"
    name_plural = "Jobs"
    icon = "fa-solid fa-briefcase"

    column_list = [
        Job.id,
        Job.title,
        Job.status,
        Job.employment_type,
        Job.workplace_type,
        Job.country,
        Job.city,
        Job.openings,
        Job.created_at,
    ]
    column_searchable_list = [Job.title, Job.city]
    column_sortable_list = [Job.title, Job.status, Job.country, Job.created_at]
    column_default_sort = [(Job.created_at, True)]

    form_excluded_columns = [Job.screening_questions, Job.application_form_schema]


class JobCategoryAdmin(ModelView, model=JobCategory):
    name = "Job Category"
    name_plural = "Job Categories"
    icon = "fa-solid fa-tags"

    column_list = [
        JobCategory.id,
        JobCategory.org_id,
        JobCategory.name,
        JobCategory.is_system_default,
        JobCategory.created_at,
    ]
    column_searchable_list = [JobCategory.name]
    column_sortable_list = [JobCategory.name, JobCategory.created_at]
    column_default_sort = [(JobCategory.created_at, True)]


class JobTeamMemberAdmin(ModelView, model=JobTeamMember):
    name = "Job Team Member"
    name_plural = "Job Team Members"
    icon = "fa-solid fa-users"

    column_list = [
        JobTeamMember.id,
        JobTeamMember.job_id,
        JobTeamMember.user_id,
        JobTeamMember.role,
        JobTeamMember.created_at,
    ]
    column_sortable_list = [JobTeamMember.role, JobTeamMember.created_at]
    column_default_sort = [(JobTeamMember.created_at, True)]


class StageAdmin(ModelView, model=Stage):
    name = "Stage"
    name_plural = "Stages"
    icon = "fa-solid fa-list-ol"

    column_list = [
        Stage.id,
        Stage.job_id,
        Stage.name,
        Stage.position,
        Stage.is_required,
        Stage.created_at,
    ]
    column_searchable_list = [Stage.name]
    column_sortable_list = [Stage.name, Stage.position, Stage.created_at]
    column_default_sort = [(Stage.job_id, False), (Stage.position, False)]


class CandidateAdmin(ModelView, model=Candidate):
    name = "Candidate"
    name_plural = "Candidates"
    icon = "fa-solid fa-person"

    column_list = [
        Candidate.id,
        Candidate.name,
        Candidate.email,
        Candidate.status,
        Candidate.source,
        Candidate.job_id,
        Candidate.created_at,
    ]
    column_searchable_list = [Candidate.name, Candidate.email]
    column_sortable_list = [Candidate.name, Candidate.email, Candidate.status, Candidate.created_at]
    column_default_sort = [(Candidate.created_at, True)]

    form_excluded_columns = [Candidate.profile_links, Candidate.parsed_resume, Candidate.tags]


class CandidateJobsAdmin(ModelView, model=CandidateJobs):
    name = "Candidate Job"
    name_plural = "Candidate Jobs"
    icon = "fa-solid fa-link"

    column_list = [
        CandidateJobs.assigned_id,
        CandidateJobs.org_id,
        CandidateJobs.candidate_id,
        CandidateJobs.job_id,
        CandidateJobs.stage_id,
        CandidateJobs.assignment_status,
        CandidateJobs.source,
        CandidateJobs.applied_at,
        CandidateJobs.assigned_at,
        CandidateJobs.created_at,
        CandidateJobs.updated_at,
    ]
    column_sortable_list = [
        CandidateJobs.assignment_status,
        CandidateJobs.created_at,
        CandidateJobs.updated_at,
    ]
    column_default_sort = [(CandidateJobs.updated_at, True)]


class CandidateDocumentAdmin(ModelView, model=CandidateDocument):
    name = "Document"
    name_plural = "Documents"
    icon = "fa-solid fa-file"

    column_list = [
        CandidateDocument.id,
        CandidateDocument.candidate_id,
        CandidateDocument.name,
        CandidateDocument.doc_type,
        CandidateDocument.mime_type,
        CandidateDocument.size_bytes,
        CandidateDocument.is_deleted,
        CandidateDocument.created_at,
    ]
    column_searchable_list = [CandidateDocument.name, CandidateDocument.field_key]
    column_sortable_list = [
        CandidateDocument.name,
        CandidateDocument.doc_type,
        CandidateDocument.created_at,
    ]
    column_default_sort = [(CandidateDocument.created_at, True)]


class JobApplicationAdmin(ModelView, model=JobApplication):
    name = "Job Application"
    name_plural = "Job Applications"
    icon = "fa-solid fa-file-pen"

    column_list = [
        JobApplication.id,
        JobApplication.job_id,
        JobApplication.full_name,
        JobApplication.email,
        JobApplication.phone,
        JobApplication.status,
        JobApplication.created_at,
    ]
    column_searchable_list = [JobApplication.full_name, JobApplication.email]
    column_sortable_list = [
        JobApplication.full_name,
        JobApplication.email,
        JobApplication.status,
        JobApplication.created_at,
    ]
    column_default_sort = [(JobApplication.created_at, True)]

    form_excluded_columns = [
        JobApplication.answers,
        JobApplication.files,
        JobApplication.schema_snapshot,
    ]


class ConversationAdmin(ModelView, model=Conversation):
    name = "Conversation"
    name_plural = "Conversations"
    icon = "fa-solid fa-comments"

    column_list = [
        Conversation.id,
        Conversation.candidate_id,
        Conversation.subject,
        Conversation.channel,
        Conversation.status,
        Conversation.last_message_at,
        Conversation.created_at,
    ]
    column_searchable_list = [Conversation.subject]
    column_sortable_list = [
        Conversation.subject,
        Conversation.status,
        Conversation.last_message_at,
        Conversation.created_at,
    ]
    column_default_sort = [(Conversation.last_message_at, True)]


class MessageAdmin(ModelView, model=Message):
    name = "Message"
    name_plural = "Messages"
    icon = "fa-solid fa-envelope-open-text"

    column_list = [
        Message.id,
        Message.conversation_id,
        Message.direction,
        Message.sender_type,
        Message.from_email,
        Message.to_email,
        Message.status,
        Message.created_at,
    ]
    column_searchable_list = [Message.from_email, Message.to_email]
    column_sortable_list = [Message.direction, Message.status, Message.created_at]
    column_default_sort = [(Message.created_at, True)]

    form_excluded_columns = [
        Message.html_body,
        Message.provider_message_id,
        Message.email_message_id,
        Message.in_reply_to,
    ]


class InboundEmailAdmin(ModelView, model=InboundEmail):
    name = "Inbound Email"
    name_plural = "Inbound Emails"
    icon = "fa-solid fa-envelope-circle-check"

    column_list = [
        InboundEmail.id,
        InboundEmail.inbox_address,
        InboundEmail.from_email,
        InboundEmail.subject,
        InboundEmail.email_kind,
        InboundEmail.parse_status,
        InboundEmail.received_at,
    ]
    column_searchable_list = [
        InboundEmail.from_email,
        InboundEmail.subject,
        InboundEmail.inbox_address,
    ]
    column_sortable_list = [
        InboundEmail.inbox_address,
        InboundEmail.parse_status,
        InboundEmail.received_at,
    ]
    column_default_sort = [(InboundEmail.received_at, True)]

    form_excluded_columns = [InboundEmail.raw_storage_key, InboundEmail.message_id]


class TemplateAdmin(ModelView, model=Template):
    name = "Template"
    name_plural = "Templates"
    icon = "fa-solid fa-file-lines"

    column_list = [
        Template.id,
        Template.org_id,
        Template.name,
        Template.subject,
        Template.created_at,
    ]
    column_searchable_list = [Template.name, Template.subject]
    column_sortable_list = [Template.name, Template.subject, Template.created_at]
    column_default_sort = [(Template.created_at, True)]


class InterviewAdmin(ModelView, model=Interview):
    name = "Interview"
    name_plural = "Interviews"
    icon = "fa-solid fa-calendar-check"

    column_list = [
        Interview.id,
        Interview.candidate_id,
        Interview.job_id,
        Interview.scheduled_at,
        Interview.duration_minutes,
        Interview.meeting_link,
        Interview.created_at,
    ]
    column_sortable_list = [
        Interview.scheduled_at,
        Interview.duration_minutes,
        Interview.created_at,
    ]
    column_default_sort = [(Interview.scheduled_at, True)]

    form_excluded_columns = [Interview.interviewer_ids]


class FeedbackAdmin(ModelView, model=Feedback):
    name = "Feedback"
    name_plural = "Feedback"
    icon = "fa-solid fa-star-half-stroke"

    column_list = [
        Feedback.id,
        Feedback.interview_id,
        Feedback.reviewer_user_id,
        Feedback.rating,
        Feedback.decision,
        Feedback.created_at,
    ]
    column_sortable_list = [Feedback.rating, Feedback.decision, Feedback.created_at]
    column_default_sort = [(Feedback.created_at, True)]


class NoteAdmin(ModelView, model=Note):
    name = "Note"
    name_plural = "Notes"
    icon = "fa-solid fa-note-sticky"

    column_list = [Note.id, Note.candidate_id, Note.author_user_id, Note.created_at]
    column_sortable_list = [Note.created_at]
    column_default_sort = [(Note.created_at, True)]

    form_excluded_columns = [Note.mentions]


class ActivityAdmin(ModelView, model=Activity):
    name = "Activity"
    name_plural = "Activities"
    icon = "fa-solid fa-bolt"

    column_list = [
        Activity.id,
        Activity.candidate_id,
        Activity.created_by_user_id,
        Activity.type,
        Activity.created_at,
    ]
    column_searchable_list = [Activity.type]
    column_sortable_list = [Activity.type, Activity.created_at]
    column_default_sort = [(Activity.created_at, True)]

    form_excluded_columns = [Activity.metadata_]


class AutomationAdmin(ModelView, model=Automation):
    name = "Automation"
    name_plural = "Automations"
    icon = "fa-solid fa-robot"

    column_list = [
        Automation.id,
        Automation.org_id,
        Automation.name,
        Automation.status,
        Automation.scope,
        Automation.trigger_key,
        Automation.job_id,
        Automation.last_run_at,
        Automation.execution_count,
        Automation.created_at,
    ]
    column_searchable_list = [Automation.name, Automation.trigger_key]
    column_sortable_list = [
        Automation.name,
        Automation.status,
        Automation.scope,
        Automation.last_run_at,
        Automation.execution_count,
        Automation.created_at,
    ]
    column_default_sort = [(Automation.created_at, True)]
    form_excluded_columns = [
        Automation.trigger_config,
        Automation.conditions,
        Automation.actions,
    ]


class AutomationExecutionAdmin(ModelView, model=AutomationExecution):
    name = "Automation Execution"
    name_plural = "Automation Executions"
    icon = "fa-solid fa-list-check"

    column_list = [
        AutomationExecution.id,
        AutomationExecution.org_id,
        AutomationExecution.automation_id,
        AutomationExecution.trigger_event,
        AutomationExecution.candidate_id,
        AutomationExecution.job_id,
        AutomationExecution.status,
        AutomationExecution.created_at,
    ]
    column_searchable_list = [AutomationExecution.trigger_event, AutomationExecution.status]
    column_sortable_list = [
        AutomationExecution.trigger_event,
        AutomationExecution.status,
        AutomationExecution.created_at,
    ]
    column_default_sort = [(AutomationExecution.created_at, True)]
    form_excluded_columns = [AutomationExecution.message]
