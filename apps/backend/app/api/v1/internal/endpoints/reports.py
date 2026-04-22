from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, select
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.candidate_jobs import CandidateJobs
from app.models.interview import Interview
from app.models.job import Job
from app.models.job_team_member import JobTeamMember
from app.models.stage import Stage
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])

# ── Pydantic Schemas ───────────────────────────────────────────────────────────


class KPIMetric(BaseModel):
    value: float
    change_pct: float
    trend: Literal["up", "down"]


class FunnelStage(BaseModel):
    stage_name: str
    count: int


class SourceItem(BaseModel):
    source: str
    candidates: int
    interviews: int
    hires: int
    hire_rate_pct: float


class RecruiterItem(BaseModel):
    user_id: str
    name: str
    candidates: int
    interviews: int
    hires: int
    avg_days: float


class JobPerformanceItem(BaseModel):
    id: str
    title: str
    applicants: int
    conversion_pct: float
    avg_days_to_hire: float
    status: str


class StageTime(BaseModel):
    stage: str
    avg_days: float


class MonthTrend(BaseModel):
    month: str
    days: float


class TimeAnalyticsData(BaseModel):
    avg_time_per_stage: list[StageTime]
    time_to_hire_trend: list[MonthTrend]


class ReportsSummaryResponse(BaseModel):
    kpis: dict[str, KPIMetric]
    pipeline_funnel: list[FunnelStage]
    source_effectiveness: list[SourceItem]
    recruiter_performance: list[RecruiterItem]
    job_performance: list[JobPerformanceItem]
    time_analytics: TimeAnalyticsData


HIRED_STATUS_CASE = case(
    (
        (CandidateJobs.assignment_status == "hired") | (sa_func.lower(Stage.name) == "hired"),
        1,
    ),
    else_=0,
)

# ── Helpers ────────────────────────────────────────────────────────────────────


def _period_to_days(period: str) -> int:
    return {"7d": 7, "30d": 30, "90d": 90, "1y": 365}.get(period, 30)


def _safe_pct_change(cur: float, prev: float) -> float:
    if prev == 0:
        return 0.0
    return round((cur - prev) / prev * 100, 1)


def _trend(cur: float, prev: float, lower_is_better: bool = False) -> Literal["up", "down"]:
    improved = cur >= prev
    return (
        ("down" if lower_is_better else "up") if improved else ("up" if lower_is_better else "down")
    )


# ── Endpoint ───────────────────────────────────────────────────────────────────


@router.get("/summary", response_model=ReportsSummaryResponse)
async def get_reports_summary(
    period: str = Query(default="30d", pattern="^(7d|30d|90d|1y)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:read")),
) -> ReportsSummaryResponse:
    org_id: UUID = current_user.org_id
    days = _period_to_days(period)
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=days)
    prev_start = period_start - timedelta(days=days)

    # ── KPIs ──────────────────────────────────────────────────────────────────

    # Total candidates created in period
    cur_candidates = (
        await db.scalar(
            select(sa_func.count(Candidate.id)).where(
                Candidate.org_id == org_id,
                Candidate.created_at >= period_start,
            )
        )
        or 0
    )
    prev_candidates = (
        await db.scalar(
            select(sa_func.count(Candidate.id)).where(
                Candidate.org_id == org_id,
                Candidate.created_at >= prev_start,
                Candidate.created_at < period_start,
            )
        )
        or 0
    )

    # Active jobs (current snapshot)
    cur_active_jobs = (
        await db.scalar(
            select(sa_func.count(Job.id)).where(
                Job.org_id == org_id,
                Job.status == "open",
            )
        )
        or 0
    )
    prev_active_jobs = (
        await db.scalar(
            select(sa_func.count(Job.id)).where(
                Job.org_id == org_id,
                Job.status == "open",
                Job.published_at < period_start,
            )
        )
        or 0
    )

    # Hires in period. Treat rows already moved to the Hired stage as hired even when
    # historical assignment_status values are stale.
    cur_hires = (
        await db.scalar(
            select(sa_func.count(CandidateJobs.assigned_id))
            .outerjoin(Stage, CandidateJobs.stage_id == Stage.id)
            .where(
                CandidateJobs.org_id == org_id,
                CandidateJobs.updated_at >= period_start,
                HIRED_STATUS_CASE == 1,
            )
        )
        or 0
    )
    prev_hires = (
        await db.scalar(
            select(sa_func.count(CandidateJobs.assigned_id))
            .outerjoin(Stage, CandidateJobs.stage_id == Stage.id)
            .where(
                CandidateJobs.org_id == org_id,
                CandidateJobs.updated_at >= prev_start,
                CandidateJobs.updated_at < period_start,
                HIRED_STATUS_CASE == 1,
            )
        )
        or 0
    )

    # Avg time to hire (days) — COALESCE(applied_at, created_at) as pipeline start
    def _tth_query(start, end=None):
        filters = [
            CandidateJobs.org_id == org_id,
            CandidateJobs.updated_at >= start,
            HIRED_STATUS_CASE == 1,
        ]
        if end is not None:
            filters.append(CandidateJobs.updated_at < end)
        return (
            select(
                sa_func.avg(
                    sa_func.extract(
                        "epoch",
                        CandidateJobs.updated_at
                        - sa_func.coalesce(CandidateJobs.applied_at, CandidateJobs.created_at),
                    )
                    / 86400.0
                )
            )
            .select_from(CandidateJobs)
            .outerjoin(Stage, CandidateJobs.stage_id == Stage.id)
            .where(*filters)
        )

    cur_avg_days = round(float(await db.scalar(_tth_query(period_start)) or 0), 1)
    prev_avg_days = round(float(await db.scalar(_tth_query(prev_start, period_start)) or 0), 1)

    # Total assignments in period (for conversion rate)
    total_assignments = (
        await db.scalar(
            select(sa_func.count(CandidateJobs.assigned_id)).where(
                CandidateJobs.org_id == org_id,
                CandidateJobs.created_at >= period_start,
            )
        )
        or 0
    )
    prev_total_assignments = (
        await db.scalar(
            select(sa_func.count(CandidateJobs.assigned_id)).where(
                CandidateJobs.org_id == org_id,
                CandidateJobs.created_at >= prev_start,
                CandidateJobs.created_at < period_start,
            )
        )
        or 0
    )

    # Offer acceptance rate: hires / (hires + candidates at Offer stage)
    offer_stage_count = (
        await db.scalar(
            select(sa_func.count(CandidateJobs.assigned_id))
            .join(Stage, CandidateJobs.stage_id == Stage.id)
            .where(
                CandidateJobs.org_id == org_id,
                Stage.name.ilike("offer"),
                CandidateJobs.updated_at >= period_start,
            )
        )
        or 0
    )
    prev_offer_stage = (
        await db.scalar(
            select(sa_func.count(CandidateJobs.assigned_id))
            .join(Stage, CandidateJobs.stage_id == Stage.id)
            .where(
                CandidateJobs.org_id == org_id,
                Stage.name.ilike("offer"),
                CandidateJobs.updated_at >= prev_start,
                CandidateJobs.updated_at < period_start,
            )
        )
        or 0
    )

    cur_offer_denom = offer_stage_count + cur_hires
    cur_offer_rate = round((cur_hires / cur_offer_denom * 100) if cur_offer_denom > 0 else 0.0, 1)
    prev_offer_denom = prev_offer_stage + prev_hires
    prev_offer_rate = round(
        (prev_hires / prev_offer_denom * 100) if prev_offer_denom > 0 else 0.0, 1
    )

    # Conversion rate: hires / total assignments
    cur_conversion = round(
        (cur_hires / total_assignments * 100) if total_assignments > 0 else 0.0, 2
    )
    prev_conversion = round(
        (prev_hires / prev_total_assignments * 100) if prev_total_assignments > 0 else 0.0, 2
    )

    kpis: dict[str, KPIMetric] = {
        "total_candidates": KPIMetric(
            value=float(cur_candidates),
            change_pct=_safe_pct_change(cur_candidates, prev_candidates),
            trend=_trend(cur_candidates, prev_candidates),
        ),
        "active_jobs": KPIMetric(
            value=float(cur_active_jobs),
            change_pct=_safe_pct_change(cur_active_jobs, prev_active_jobs),
            trend=_trend(cur_active_jobs, prev_active_jobs),
        ),
        "hires": KPIMetric(
            value=float(cur_hires),
            change_pct=_safe_pct_change(cur_hires, prev_hires),
            trend=_trend(cur_hires, prev_hires),
        ),
        "avg_time_to_hire_days": KPIMetric(
            value=cur_avg_days,
            change_pct=_safe_pct_change(cur_avg_days, prev_avg_days),
            trend=_trend(cur_avg_days, prev_avg_days, lower_is_better=True),
        ),
        "offer_acceptance_rate": KPIMetric(
            value=cur_offer_rate,
            change_pct=_safe_pct_change(cur_offer_rate, prev_offer_rate),
            trend=_trend(cur_offer_rate, prev_offer_rate),
        ),
        "conversion_rate": KPIMetric(
            value=cur_conversion,
            change_pct=_safe_pct_change(cur_conversion, prev_conversion),
            trend=_trend(cur_conversion, prev_conversion),
        ),
    }

    # ── Pipeline Funnel ────────────────────────────────────────────────────────
    # Count by stage position (cumulative: position >= N means reached that level)
    position_counts_result = await db.execute(
        select(Stage.position, sa_func.count(CandidateJobs.assigned_id).label("cnt"))
        .join(CandidateJobs, CandidateJobs.stage_id == Stage.id)
        .where(
            CandidateJobs.org_id == org_id,
            CandidateJobs.created_at >= period_start,
            CandidateJobs.assignment_status != "withdrawn",
        )
        .group_by(Stage.position)
    )
    pos_map: dict[int, int] = {row.position: row.cnt for row in position_counts_result.fetchall()}

    # Candidates with no stage_id (counted as Applied only)
    no_stage_count = (
        await db.scalar(
            select(sa_func.count(CandidateJobs.assigned_id)).where(
                CandidateJobs.org_id == org_id,
                CandidateJobs.stage_id.is_(None),
                CandidateJobs.created_at >= period_start,
                CandidateJobs.assignment_status != "withdrawn",
            )
        )
        or 0
    )

    def _cumulative(min_pos: int) -> int:
        return sum(v for k, v in pos_map.items() if k >= min_pos)

    total_non_withdrawn = sum(pos_map.values()) + no_stage_count

    pipeline_funnel = [
        FunnelStage(stage_name="Applied", count=total_non_withdrawn),
        FunnelStage(stage_name="Screening", count=_cumulative(1)),
        FunnelStage(stage_name="Interview", count=_cumulative(2)),
        FunnelStage(stage_name="Offer", count=_cumulative(3)),
        FunnelStage(stage_name="Hired", count=_cumulative(4)),
    ]

    # ── Source Effectiveness ───────────────────────────────────────────────────
    # Interview subquery: count interviews per (candidate_id, job_id) for the org
    interview_sub = (
        select(
            Interview.candidate_id,
            Interview.job_id,
            sa_func.count(Interview.id).label("interview_cnt"),
        )
        .where(Interview.org_id == org_id)
        .group_by(Interview.candidate_id, Interview.job_id)
        .subquery()
    )

    source_result = await db.execute(
        select(
            CandidateJobs.source,
            sa_func.count(CandidateJobs.assigned_id).label("total"),
            sa_func.sum(HIRED_STATUS_CASE).label("hires"),
            sa_func.sum(sa_func.coalesce(interview_sub.c.interview_cnt, 0)).label("interviews"),
        )
        .outerjoin(Stage, CandidateJobs.stage_id == Stage.id)
        .outerjoin(
            interview_sub,
            (interview_sub.c.candidate_id == CandidateJobs.candidate_id)
            & (interview_sub.c.job_id == CandidateJobs.job_id),
        )
        .where(
            CandidateJobs.org_id == org_id,
            CandidateJobs.created_at >= period_start,
        )
        .group_by(CandidateJobs.source)
        .order_by(sa_func.count(CandidateJobs.assigned_id).desc())
    )

    source_effectiveness: list[SourceItem] = []
    for row in source_result.fetchall():
        total = row.total or 0
        hires = int(row.hires or 0)
        interviews = int(row.interviews or 0)
        source_effectiveness.append(
            SourceItem(
                source=row.source or "Other",
                candidates=total,
                interviews=interviews,
                hires=hires,
                hire_rate_pct=round(hires / total * 100, 1) if total > 0 else 0.0,
            )
        )

    # ── Recruiter Performance ──────────────────────────────────────────────────
    # Aggregate per recruiter via Job -> JobTeamMember -> User
    recruiter_stats_sub = (
        select(
            JobTeamMember.user_id,
            sa_func.count(CandidateJobs.assigned_id).label("candidates"),
            sa_func.sum(HIRED_STATUS_CASE).label("hires"),
            sa_func.avg(
                case(
                    (
                        HIRED_STATUS_CASE == 1,
                        sa_func.extract(
                            "epoch",
                            CandidateJobs.updated_at
                            - sa_func.coalesce(CandidateJobs.applied_at, CandidateJobs.created_at),
                        )
                        / 86400.0,
                    ),
                    else_=None,
                )
            ).label("avg_days"),
        )
        .join(Job, CandidateJobs.job_id == Job.id)
        .outerjoin(Stage, CandidateJobs.stage_id == Stage.id)
        .join(
            JobTeamMember,
            (JobTeamMember.job_id == Job.id)
            & JobTeamMember.role.in_(["recruiter", "hiring_manager"]),
        )
        .where(
            CandidateJobs.org_id == org_id,
            CandidateJobs.created_at >= period_start,
        )
        .group_by(JobTeamMember.user_id)
        .order_by(sa_func.sum(HIRED_STATUS_CASE).desc())
        .limit(10)
        .subquery()
    )

    recruiter_rows = await db.execute(
        select(
            User.id,
            User.name,
            recruiter_stats_sub.c.candidates,
            recruiter_stats_sub.c.hires,
            recruiter_stats_sub.c.avg_days,
        ).join(recruiter_stats_sub, User.id == recruiter_stats_sub.c.user_id)
    )

    # Interview counts per recruiter (by created_by_user_id)
    interview_by_recruiter_result = await db.execute(
        select(
            Interview.created_by_user_id,
            sa_func.count(Interview.id).label("cnt"),
        )
        .where(
            Interview.org_id == org_id,
            Interview.created_at >= period_start,
        )
        .group_by(Interview.created_by_user_id)
    )
    interviews_by_recruiter: dict[str, int] = {
        str(r.created_by_user_id): r.cnt for r in interview_by_recruiter_result.fetchall()
    }

    recruiter_performance: list[RecruiterItem] = []
    for row in recruiter_rows.fetchall():
        recruiter_performance.append(
            RecruiterItem(
                user_id=str(row.id),
                name=row.name,
                candidates=row.candidates or 0,
                interviews=interviews_by_recruiter.get(str(row.id), 0),
                hires=int(row.hires or 0),
                avg_days=round(float(row.avg_days or 0), 0),
            )
        )

    # ── Job Performance ────────────────────────────────────────────────────────
    job_rows = await db.execute(
        select(
            Job.id,
            Job.title,
            Job.status,
            sa_func.count(CandidateJobs.assigned_id).label("applicants"),
            sa_func.sum(HIRED_STATUS_CASE).label("hires"),
            sa_func.avg(
                case(
                    (
                        HIRED_STATUS_CASE == 1,
                        sa_func.extract(
                            "epoch",
                            CandidateJobs.updated_at
                            - sa_func.coalesce(CandidateJobs.applied_at, CandidateJobs.created_at),
                        )
                        / 86400.0,
                    ),
                    else_=None,
                )
            ).label("avg_days"),
        )
        .join(CandidateJobs, CandidateJobs.job_id == Job.id)
        .outerjoin(Stage, CandidateJobs.stage_id == Stage.id)
        .where(
            Job.org_id == org_id,
            CandidateJobs.created_at >= period_start,
        )
        .group_by(Job.id, Job.title, Job.status)
        .order_by(sa_func.count(CandidateJobs.assigned_id).desc())
        .limit(20)
    )

    STATUS_MAP = {"open": "Active", "archived": "Closed", "draft": "Draft"}
    job_performance: list[JobPerformanceItem] = []
    for row in job_rows.fetchall():
        applicants = row.applicants or 0
        hires = int(row.hires or 0)
        job_performance.append(
            JobPerformanceItem(
                id=str(row.id),
                title=row.title,
                applicants=applicants,
                conversion_pct=round(hires / applicants * 100, 1) if applicants > 0 else 0.0,
                avg_days_to_hire=round(float(row.avg_days or 0), 1),
                status=STATUS_MAP.get(row.status, row.status),
            )
        )

    # ── Time Analytics ─────────────────────────────────────────────────────────
    # Avg time in stage: avg pipeline time for candidates currently at each stage
    stage_time_result = await db.execute(
        select(
            Stage.name,
            Stage.position,
            sa_func.avg(
                sa_func.extract(
                    "epoch",
                    CandidateJobs.updated_at
                    - sa_func.coalesce(CandidateJobs.applied_at, CandidateJobs.created_at),
                )
                / 86400.0
            ).label("avg_days"),
        )
        .join(Stage, CandidateJobs.stage_id == Stage.id)
        .where(
            CandidateJobs.org_id == org_id,
            CandidateJobs.created_at >= period_start,
            Stage.name.in_(["Screening", "Interview", "Offer", "Hired"]),
            CandidateJobs.assignment_status != "withdrawn",
        )
        .group_by(Stage.name, Stage.position)
        .order_by(Stage.position)
    )

    avg_time_per_stage: list[StageTime] = [
        StageTime(stage=row.name, avg_days=round(float(row.avg_days or 0), 1))
        for row in stage_time_result.fetchall()
    ]

    # Time to hire trend (last 6 months)
    # Group by DATE_TRUNC('month', updated_at) — a single expression that PostgreSQL
    # can reference consistently in both SELECT and GROUP BY without parameter mismatch.
    month_trunc = sa_func.date_trunc("month", CandidateJobs.updated_at)

    trend_result = await db.execute(
        select(
            month_trunc.label("month_start"),
            sa_func.avg(
                sa_func.extract(
                    "epoch",
                    CandidateJobs.updated_at
                    - sa_func.coalesce(CandidateJobs.applied_at, CandidateJobs.created_at),
                )
                / 86400.0
            ).label("avg_days"),
        )
        .where(
            CandidateJobs.org_id == org_id,
            CandidateJobs.updated_at >= now - timedelta(days=180),
            HIRED_STATUS_CASE == 1,
        )
        .group_by(month_trunc)
        .order_by(month_trunc)
    )

    time_to_hire_trend: list[MonthTrend] = [
        MonthTrend(
            month=row.month_start.strftime("%b") if row.month_start else "",
            days=round(float(row.avg_days or 0), 1),
        )
        for row in trend_result.fetchall()
    ]

    return ReportsSummaryResponse(
        kpis=kpis,
        pipeline_funnel=pipeline_funnel,
        source_effectiveness=source_effectiveness,
        recruiter_performance=recruiter_performance,
        job_performance=job_performance,
        time_analytics=TimeAnalyticsData(
            avg_time_per_stage=avg_time_per_stage,
            time_to_hire_trend=time_to_hire_trend,
        ),
    )
