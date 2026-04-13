"""Inbound/outbound email Temporal workflows (SES, S3, SNS).

Do not import app.temporal.email.queue here: it pulls in get_temporal_client
and breaks workflow sandbox validation. Import enqueue_* from
app.temporal.email.queue at call sites.
"""

from app.temporal.email.types import InboundWorkflowInput, OutboundWorkflowInput
from app.temporal.email.workflow import InboundEmailWorkflow, OutboundEmailWorkflow

__all__ = [
    "InboundWorkflowInput",
    "OutboundWorkflowInput",
    "InboundEmailWorkflow",
    "OutboundEmailWorkflow",
]
