from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.session import get_db
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
    await db.delete(template)
    await db.commit()
