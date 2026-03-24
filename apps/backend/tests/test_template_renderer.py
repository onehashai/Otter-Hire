"""
Unit tests for template rendering service.

Tests variable substitution and context building for automation emails.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.job import Job
from app.models.organization import Organization
from app.models.stage import Stage
from app.services.automation.template_renderer import build_template_context, render_template
from app.utils.uuid import uuid7


@pytest.fixture
async def test_org(db: AsyncSession) -> Organization:
    """Create test organization."""
    org = Organization(
        id=uuid7(),
        name="Acme Corp",
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@pytest.fixture
async def test_job(db: AsyncSession, test_org: Organization) -> Job:
    """Create test job."""
    job = Job(
        id=uuid7(),
        org_id=test_org.id,
        title="Senior Software Engineer",
        city="San Francisco",
        country="USA",
        status="open",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@pytest.fixture
async def test_stage(db: AsyncSession, test_org: Organization, test_job: Job) -> Stage:
    """Create test stage."""
    stage = Stage(
        id=uuid7(),
        org_id=test_org.id,
        job_id=test_job.id,
        name="Interview",
        position=2,
    )
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    return stage


@pytest.fixture
async def test_candidate(
    db: AsyncSession, test_org: Organization, test_job: Job, test_stage: Stage
) -> Candidate:
    """Create test candidate."""
    candidate = Candidate(
        id=uuid7(),
        org_id=test_org.id,
        job_id=test_job.id,
        stage_id=test_stage.id,
        name="John Doe",
        email="john.doe@example.com",
        phone="+1234567890",
        status="active",
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return candidate


@pytest.mark.asyncio
async def test_render_template_basic_substitution():
    """Test basic variable substitution."""
    template = "Hello {{candidate_name}}, welcome to {{company_name}}!"
    context = {
        "candidate_name": "John Doe",
        "company_name": "Acme Corp",
    }
    
    result = render_template(template, context)
    
    assert result == "Hello John Doe, welcome to Acme Corp!"


@pytest.mark.asyncio
async def test_render_template_multiple_variables():
    """Test multiple variable substitution."""
    template = "Hi {{candidate_name}}, you applied for {{job_title}} at {{company_name}} in {{job_location}}."
    context = {
        "candidate_name": "Jane Smith",
        "job_title": "Product Manager",
        "company_name": "Tech Inc",
        "job_location": "New York, USA",
    }
    
    result = render_template(template, context)
    
    assert result == "Hi Jane Smith, you applied for Product Manager at Tech Inc in New York, USA."


@pytest.mark.asyncio
async def test_render_template_missing_variable():
    """Test handling of missing variables."""
    template = "Hello {{candidate_name}}, your phone is {{candidate_phone}}."
    context = {
        "candidate_name": "John Doe",
        # candidate_phone is missing
    }
    
    result = render_template(template, context)
    
    # Missing variables should remain as placeholders
    assert "{{candidate_phone}}" in result


@pytest.mark.asyncio
async def test_render_template_empty_string():
    """Test rendering empty template."""
    result = render_template("", {"key": "value"})
    assert result == ""


@pytest.mark.asyncio
async def test_render_template_no_variables():
    """Test template with no variables."""
    template = "This is a plain text email with no variables."
    result = render_template(template, {})
    assert result == template


@pytest.mark.asyncio
async def test_build_template_context_complete(
    db: AsyncSession,
    test_org: Organization,
    test_job: Job,
    test_stage: Stage,
    test_candidate: Candidate,
):
    """Test building complete template context with all data."""
    context = await build_template_context(
        db=db,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=test_job.id,
    )
    
    assert context["candidate_name"] == "John Doe"
    assert context["candidate_email"] == "john.doe@example.com"
    assert context["candidate_phone"] == "+1234567890"
    assert context["job_title"] == "Senior Software Engineer"
    assert context["job_location"] == "San Francisco, USA"
    assert context["company_name"] == "Acme Corp"
    assert context["org_name"] == "Acme Corp"
    assert context["stage_name"] == "Interview"


@pytest.mark.asyncio
async def test_build_template_context_no_job(
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
):
    """Test building context without job."""
    # Update candidate to have no job
    test_candidate.job_id = None
    test_candidate.stage_id = None
    await db.commit()
    
    context = await build_template_context(
        db=db,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
    )
    
    assert context["candidate_name"] == "John Doe"
    assert context["candidate_email"] == "john.doe@example.com"
    assert context["job_title"] == ""
    assert context["job_location"] == ""
    assert context["stage_name"] == ""


@pytest.mark.asyncio
async def test_build_template_context_partial_job_location(
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
):
    """Test job location with only city or country."""
    # Create job with only city
    job_city_only = Job(
        id=uuid7(),
        org_id=test_org.id,
        title="Developer",
        city="Boston",
        country=None,
        status="open",
    )
    db.add(job_city_only)
    await db.commit()
    
    context = await build_template_context(
        db=db,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=job_city_only.id,
    )
    
    assert context["job_location"] == "Boston"


@pytest.mark.asyncio
async def test_build_template_context_with_metadata(
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
):
    """Test metadata override in context."""
    metadata = {
        "stage_name": "Offer Extended",
        "custom_field": "custom_value",
    }
    
    context = await build_template_context(
        db=db,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
        metadata=metadata,
    )
    
    # Metadata should override stage_name
    assert context["stage_name"] == "Offer Extended"


@pytest.mark.asyncio
async def test_build_template_context_missing_candidate(
    db: AsyncSession,
    test_org: Organization,
):
    """Test handling of missing candidate."""
    fake_candidate_id = uuid7()
    
    context = await build_template_context(
        db=db,
        candidate_id=fake_candidate_id,
        org_id=test_org.id,
        job_id=None,
    )
    
    # Should return empty strings for missing candidate
    assert context["candidate_name"] == ""
    assert context["candidate_email"] == ""
    assert context["candidate_phone"] == ""


@pytest.mark.asyncio
async def test_render_template_with_real_context(
    db: AsyncSession,
    test_org: Organization,
    test_job: Job,
    test_candidate: Candidate,
):
    """Integration test: build context and render template."""
    context = await build_template_context(
        db=db,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=test_job.id,
    )
    
    template = """Dear {{candidate_name}},

Thank you for applying to {{job_title}} at {{company_name}}.

Your application is currently at {{stage_name}} stage.

Best regards,
{{company_name}} Team"""
    
    result = render_template(template, context)
    
    assert "Dear John Doe," in result
    assert "Senior Software Engineer" in result
    assert "Acme Corp" in result
    assert "Interview stage" in result
