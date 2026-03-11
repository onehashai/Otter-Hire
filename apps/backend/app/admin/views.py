# ruff: noqa: E501

from sqladmin import ModelView

from app.models.activity import Activity
from app.models.candidate import Candidate
from app.models.candidate_document import CandidateDocument
from app.models.conversation import Conversation
from app.models.email import Email, InboundEmail, InboundEmailAttachment
from app.models.email_template import EmailTemplate
from app.models.feedback import Feedback
from app.models.integration import OrgIntegration
from app.models.interview import Interview
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.job_category import JobCategory
from app.models.job_team_member import JobTeamMember
from app.models.message import Message
from app.models.note import Note
from app.models.org_membership import OrgMembership
from app.models.organization import Organization, OrgInbox
from app.models.stage import Stage
from app.models.user import User


class UserAdmin(ModelView, model=User):
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"
    category = "People"

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
    category = "People"

    column_list = [
        Organization.id,
        Organization.name,
        Organization.website,
        Organization.created_at,
    ]
    column_searchable_list = [Organization.name, Organization.website]
    column_sortable_list = [Organization.name, Organization.created_at]
    column_default_sort = [(Organization.created_at, True)]


class OrgInboxAdmin(ModelView, model=OrgInbox):
    name = "Org Inbox"
    name_plural = "Org Inboxes"
    icon = "fa-solid fa-inbox"
    category = "People"

    column_list = [
        OrgInbox.id,
        OrgInbox.inbox_address,
        OrgInbox.provider,
        OrgInbox.status,
        OrgInbox.verification_status,
        OrgInbox.created_at,
    ]
    column_searchable_list = [OrgInbox.inbox_address]
    column_sortable_list = [OrgInbox.inbox_address, OrgInbox.status, OrgInbox.created_at]
    column_default_sort = [(OrgInbox.created_at, True)]

    form_excluded_columns = [OrgInbox.secret_hash, OrgInbox.verification_token_hash]
    column_details_exclude_list = [OrgInbox.secret_hash, OrgInbox.verification_token_hash]


class OrgMembershipAdmin(ModelView, model=OrgMembership):
    name = "Org Membership"
    name_plural = "Org Memberships"
    icon = "fa-solid fa-id-badge"
    category = "People"

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


class OrgIntegrationAdmin(ModelView, model=OrgIntegration):
    name = "Integration"
    name_plural = "Integrations"
    icon = "fa-solid fa-plug"
    category = "People"

    column_list = [
        OrgIntegration.id,
        OrgIntegration.org_id,
        OrgIntegration.integration_type,
        OrgIntegration.status,
        OrgIntegration.last_tested_at,
        OrgIntegration.created_at,
    ]
    column_searchable_list = [OrgIntegration.integration_type]
    column_sortable_list = [
        OrgIntegration.integration_type,
        OrgIntegration.status,
        OrgIntegration.created_at,
    ]
    column_default_sort = [(OrgIntegration.created_at, True)]

    form_excluded_columns = [OrgIntegration.encrypted_credentials]
    column_details_exclude_list = [OrgIntegration.encrypted_credentials]


class JobAdmin(ModelView, model=Job):
    name = "Job"
    name_plural = "Jobs"
    icon = "fa-solid fa-briefcase"
    category = "Recruitment"

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
    category = "Recruitment"

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
    category = "Recruitment"

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
    category = "Recruitment"

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
    category = "Candidates"

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

    form_excluded_columns = [Candidate.profile_links, Candidate.tags]


class CandidateDocumentAdmin(ModelView, model=CandidateDocument):
    name = "Candidate Document"
    name_plural = "Candidate Documents"
    icon = "fa-solid fa-file"
    category = "Candidates"

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
    category = "Candidates"

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
    category = "Messaging"

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
    category = "Messaging"

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


class EmailAdmin(ModelView, model=Email):
    name = "Email"
    name_plural = "Emails"
    icon = "fa-solid fa-envelope"
    category = "Messaging"

    column_list = [
        Email.id,
        Email.candidate_id,
        Email.to_email,
        Email.subject,
        Email.direction,
        Email.status,
        Email.created_at,
    ]
    column_searchable_list = [Email.to_email, Email.subject]
    column_sortable_list = [Email.subject, Email.direction, Email.status, Email.created_at]
    column_default_sort = [(Email.created_at, True)]

    form_excluded_columns = [Email.provider_message_id]


class InboundEmailAdmin(ModelView, model=InboundEmail):
    name = "Inbound Email"
    name_plural = "Inbound Emails"
    icon = "fa-solid fa-envelope-circle-check"
    category = "Messaging"

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


class InboundEmailAttachmentAdmin(ModelView, model=InboundEmailAttachment):
    name = "Inbound Email Attachment"
    name_plural = "Inbound Email Attachments"
    icon = "fa-solid fa-paperclip"
    category = "Messaging"

    column_list = [
        InboundEmailAttachment.id,
        InboundEmailAttachment.inbound_email_id,
        InboundEmailAttachment.filename,
        InboundEmailAttachment.content_type,
        InboundEmailAttachment.size_bytes,
        InboundEmailAttachment.created_at,
    ]
    column_searchable_list = [InboundEmailAttachment.filename, InboundEmailAttachment.content_type]
    column_sortable_list = [
        InboundEmailAttachment.filename,
        InboundEmailAttachment.size_bytes,
        InboundEmailAttachment.created_at,
    ]
    column_default_sort = [(InboundEmailAttachment.created_at, True)]

    form_excluded_columns = [InboundEmailAttachment.storage_key, InboundEmailAttachment.sha256]


class EmailTemplateAdmin(ModelView, model=EmailTemplate):
    name = "Email Template"
    name_plural = "Email Templates"
    icon = "fa-solid fa-file-lines"
    category = "Messaging"

    column_list = [
        EmailTemplate.id,
        EmailTemplate.org_id,
        EmailTemplate.name,
        EmailTemplate.subject,
        EmailTemplate.created_at,
    ]
    column_searchable_list = [EmailTemplate.name, EmailTemplate.subject]
    column_sortable_list = [EmailTemplate.name, EmailTemplate.subject, EmailTemplate.created_at]
    column_default_sort = [(EmailTemplate.created_at, True)]


class InterviewAdmin(ModelView, model=Interview):
    name = "Interview"
    name_plural = "Interviews"
    icon = "fa-solid fa-calendar-check"
    category = "Evaluation"

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
    category = "Evaluation"

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
    category = "Evaluation"

    column_list = [Note.id, Note.candidate_id, Note.author_user_id, Note.created_at]
    column_sortable_list = [Note.created_at]
    column_default_sort = [(Note.created_at, True)]

    form_excluded_columns = [Note.mentions]


class ActivityAdmin(ModelView, model=Activity):
    name = "Activity"
    name_plural = "Activities"
    icon = "fa-solid fa-bolt"
    category = "Evaluation"

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
