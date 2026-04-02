import logging

logger = logging.getLogger(__name__)


async def enqueue_ses_raw_key(bucket: str, key: str) -> None:
    """Stub for S3 event queue processing.

    This function is called when S3 events are received for inbound emails.
    Currently not implemented - emails are processed via direct webhook.
    """
    logger.info("S3 event received: bucket=%s key=%s (not processed)", bucket, key)
