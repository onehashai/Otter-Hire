from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.automation import Automation
from app.models.template import Template
from app.models.user import User
from app.schemas.templates import (
    TemplateCreateRequest,
    TemplateResponse,
    TemplateUpdateRequest,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("templates:read")),
):
    result = await db.execute(
        select(Template)
        .where(Template.org_id == current_user.org_id)
        .order_by(Template.updated_at.desc())
    )
    templates = result.scalars().all()
    return [
        TemplateResponse(
            id=str(t.id),
            name=t.name,
            category=t.category,
            subject=t.subject,
            body=t.body or "",
            created_at=t.created_at.isoformat(),
            updated_at=t.updated_at.isoformat(),
        )
        for t in templates
    ]


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("templates:read")),
):
    result = await db.execute(
        select(Template).where(
            Template.id == template_id,
            Template.org_id == current_user.org_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return TemplateResponse(
        id=str(template.id),
        name=template.name,
        category=template.category,
        subject=template.subject,
        body=template.body or "",
        created_at=template.created_at.isoformat(),
        updated_at=template.updated_at.isoformat(),
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TemplateResponse)
async def create_template(
    body: TemplateCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("templates:create")),
):
    template = Template(
        org_id=current_user.org_id,
        name=body.name.strip(),
        category=body.category.strip() or "Email",
        subject=body.subject.strip(),
        body=body.body or "",
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateResponse(
        id=str(template.id),
        name=template.name,
        category=template.category,
        subject=template.subject,
        body=template.body or "",
        created_at=template.created_at.isoformat(),
        updated_at=template.updated_at.isoformat(),
    )


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: UUID,
    body: TemplateUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("templates:update")),
):
    result = await db.execute(
        select(Template).where(
            Template.id == template_id,
            Template.org_id == current_user.org_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if body.name is not None:
        template.name = body.name.strip()
    if body.category is not None:
        template.category = body.category.strip() or "Email"
    if body.subject is not None:
        template.subject = body.subject.strip()
    if body.body is not None:
        template.body = body.body
    await db.commit()
    await db.refresh(template)
    return TemplateResponse(
        id=str(template.id),
        name=template.name,
        category=template.category,
        subject=template.subject,
        body=template.body or "",
        created_at=template.created_at.isoformat(),
        updated_at=template.updated_at.isoformat(),
    )


@router.get("/{template_id}/usages")
async def get_template_usages(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("templates:read")),
):
    """Return automations that reference this template in their actions."""
    result = await db.execute(
        select(Template).where(
            Template.id == template_id,
            Template.org_id == current_user.org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    automations_result = await db.execute(
        select(Automation).where(
            Automation.org_id == current_user.org_id,
            text(
                "EXISTS ("
                "  SELECT 1 FROM jsonb_array_elements(automations.actions) AS _act"
                "  WHERE _act->'config'->>'template' = :tid"
                ")"
            ).bindparams(tid=str(template_id)),
        )
    )
    automations = automations_result.scalars().all()
    return {"automations": [{"id": str(a.id), "name": a.name} for a in automations]}


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("templates:delete")),
):
    result = await db.execute(
        select(Template).where(
            Template.id == template_id,
            Template.org_id == current_user.org_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    # Check if any automation references this template inside its actions JSONB array.
    # jsonb_array_elements unnests each action object; ->> extracts the template value as text.
    automations_result = await db.execute(
        select(Automation).where(
            Automation.org_id == current_user.org_id,
            text(
                "EXISTS ("
                "  SELECT 1 FROM jsonb_array_elements(automations.actions) AS _act"
                "  WHERE _act->'config'->>'template' = :tid"
                ")"
            ).bindparams(tid=str(template_id)),
        )
    )
    automations_in_use = automations_result.scalars().all()
    if automations_in_use:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "code": "TEMPLATE_IN_USE",
                "detail": "Template is currently used in one or more automations",
                "details": {
                    "automations": [{"id": str(a.id), "name": a.name} for a in automations_in_use]
                },
            },
        )

    await db.delete(template)
    await db.commit()
