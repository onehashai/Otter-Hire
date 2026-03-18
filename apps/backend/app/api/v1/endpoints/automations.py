from datetime import datetime
from typing import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.automation import Automation, AutomationExecution
from app.models.user import User
from app.schemas.automations import (
    AutomationCreateRequest,
    AutomationDetailResponse,
    AutomationExecutionLogEntry,
    AutomationListItemResponse,
    AutomationUpdateRequest,
)


router = APIRouter(prefix="/automations", tags=["automations"])


def _build_list_item(
    automation: Automation, created_by_name: str | None
) -> AutomationListItemResponse:
    trigger_label = automation.trigger_config.get("label") or automation.trigger_key
    # For now, use the first action as the primary label if present
    actions = automation.actions or []
    first_action = actions[0] if actions else {}
    action_label = first_action.get("label") or first_action.get("type") or "Action"

    return AutomationListItemResponse(
        id=str(automation.id),
        name=automation.name,
        status=automation.status,
        scope=automation.scope,
        trigger_type=automation.trigger_type,
        trigger_label=str(trigger_label),
        action_label=str(action_label),
        last_run_at=automation.last_run_at,
        execution_count=automation.execution_count or 0,
        created_by_name=created_by_name,
        created_at=automation.created_at,
        updated_at=automation.updated_at,
    )


def _build_detail(automation: Automation, created_by_name: str | None) -> AutomationDetailResponse:
    return AutomationDetailResponse(
        id=str(automation.id),
        name=automation.name,
        status=automation.status,
        scope=automation.scope,
        job_id=str(automation.job_id) if automation.job_id else None,
        pipeline_id=str(automation.pipeline_id) if automation.pipeline_id else None,
        trigger_type=automation.trigger_type,
        trigger_key=automation.trigger_key,
        trigger_config=automation.trigger_config or {},
        condition_logic=automation.condition_logic,
        conditions=automation.conditions or [],
        actions=automation.actions or [],
        description=automation.description,
        last_run_at=automation.last_run_at,
        execution_count=automation.execution_count or 0,
        created_by_name=created_by_name,
        created_at=automation.created_at,
        updated_at=automation.updated_at,
    )


async def _get_automation_or_404(
    db: AsyncSession, automation_id: UUID, org_id: UUID
) -> Automation:
    stmt = (
        select(Automation)
        .where(Automation.id == automation_id, Automation.org_id == org_id)
        .options(joinedload(Automation.created_by))
    )
    result = await db.execute(stmt)
    automation = result.scalar_one_or_none()
    if automation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found",
        )
    return automation


@router.get("", response_model=list[AutomationListItemResponse])
async def list_automations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("automations:read")),
):
    stmt = (
        select(
            Automation,
            sa_func.coalesce(Automation.execution_count, 0).label("execution_count"),
            User.name.label("created_by_name"),
        )
        .join(User, User.id == Automation.created_by_user_id)
        .where(Automation.org_id == current_user.org_id)
        .order_by(Automation.updated_at.desc())
    )

    result = await db.execute(stmt)
    rows: Sequence[tuple[Automation, int, str | None]] = result.all()

    items: list[AutomationListItemResponse] = []
    for automation, execution_count, created_by_name in rows:
        automation.execution_count = execution_count
        items.append(_build_list_item(automation, created_by_name))
    return items


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AutomationDetailResponse)
async def create_automation(
    body: AutomationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("automations:create")),
):
    automation = Automation(
        org_id=current_user.org_id,
        created_by_user_id=current_user.id,
        name=body.name,
        status=body.status or "draft",
        scope=body.scope or "all",
        job_id=body.job_id,
        pipeline_id=body.pipeline_id,
        trigger_type=body.trigger_type,
        trigger_key=body.trigger_key,
        trigger_config=body.trigger_config or {},
        condition_logic=body.condition_logic or "and",
        conditions=[c.model_dump() for c in body.conditions],
        actions=[a.model_dump() for a in body.actions],
        description=body.description,
    )
    db.add(automation)
    await db.commit()
    await db.refresh(automation)

    created_by_name = current_user.name
    return _build_detail(automation, created_by_name)


@router.get("/{automation_id}", response_model=AutomationDetailResponse)
async def get_automation(
    automation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("automations:read")),
):
    automation = await _get_automation_or_404(db, automation_id, current_user.org_id)
    created_by_name = automation.created_by.name if automation.created_by else None
    return _build_detail(automation, created_by_name)


@router.patch("/{automation_id}", response_model=AutomationDetailResponse)
async def update_automation(
    automation_id: UUID,
    body: AutomationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("automations:update")),
):
    automation = await _get_automation_or_404(db, automation_id, current_user.org_id)

    update_data = body.model_dump(exclude_unset=True)

    # Nested structures are Pydantic models / lists of models
    if "conditions" in update_data and update_data["conditions"] is not None:
        automation.conditions = [c.model_dump() for c in update_data.pop("conditions")]
    if "actions" in update_data and update_data["actions"] is not None:
        automation.actions = [a.model_dump() for a in update_data.pop("actions")]

    for field, value in update_data.items():
        setattr(automation, field, value)

    automation.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(automation)

    created_by_name = automation.created_by.name if automation.created_by else None
    return _build_detail(automation, created_by_name)


@router.delete("/{automation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation(
    automation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("automations:delete")),
):
    automation = await _get_automation_or_404(db, automation_id, current_user.org_id)
    await db.delete(automation)
    await db.commit()
    return None


@router.get(
    "/{automation_id}/executions",
    response_model=list[AutomationExecutionLogEntry],
)
async def list_automation_executions(
    automation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("automations:read")),
):
    stmt = (
        select(AutomationExecution)
        .where(
            AutomationExecution.org_id == current_user.org_id,
            AutomationExecution.automation_id == automation_id,
        )
        .order_by(AutomationExecution.created_at.desc())
        .limit(100)
    )
    result = await db.execute(stmt)
    rows: Sequence[AutomationExecution] = result.scalars().all()
    return [
        AutomationExecutionLogEntry(
            id=str(row.id),
            trigger_event=row.trigger_event,
            candidate_id=str(row.candidate_id) if row.candidate_id else None,
            job_id=str(row.job_id) if row.job_id else None,
            status=row.status,
            message=row.message,
            created_at=row.created_at,
        )
        for row in rows
    ]

