import logging
import sys

from app.core.config import settings


def setup_logging():
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )


logger = logging.getLogger("ats_backend")

# Run once on first import so stdlib logging is configured before `import sentry`
# runs Sentry SDK init (visible init logs use this format).
setup_logging()
