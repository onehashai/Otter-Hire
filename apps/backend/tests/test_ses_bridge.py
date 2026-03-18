import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

from app.integrations.app_store.email_integration.ses_bridge import _list_latest_raw_keys


class ListLatestRawKeysTests(unittest.TestCase):
    def test_keeps_newest_across_multiple_pages(self):
        base = datetime(2026, 3, 13, 4, 0, tzinfo=timezone.utc)
        page_1 = {
            "Contents": [
                {"Key": "ats/raw/a", "LastModified": base},
                {"Key": "ats/raw/b", "LastModified": base + timedelta(minutes=1)},
            ]
        }
        page_2 = {
            "Contents": [
                {"Key": "ats/raw/c", "LastModified": base + timedelta(minutes=90)},
                {"Key": "ats/raw/d", "LastModified": base + timedelta(minutes=80)},
            ]
        }

        paginator = Mock()
        paginator.paginate.return_value = [page_1, page_2]

        s3_client = Mock()
        s3_client.get_paginator.return_value = paginator

        latest, pages_scanned, objects_seen, newest_seen = _list_latest_raw_keys(
            s3_client=s3_client,
            bucket="onehash-ats-test",
            prefix="ats-staging/ses-inbound/raw/",
            limit=2,
        )

        self.assertEqual(pages_scanned, 2)
        self.assertEqual(objects_seen, 4)
        self.assertEqual(newest_seen, base + timedelta(minutes=90))
        self.assertEqual([key for key, _ in latest], ["ats/raw/c", "ats/raw/d"])
