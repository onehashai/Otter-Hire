"""Temporal platform code: client, worker process, and workflows.

Avoid importing app.temporal.client here: loading Settings during workflow
sandbox validation triggers RestrictedWorkflowAccessError (pathlib / dotenv).
Import get_temporal_client from app.temporal.client at call sites.
"""
