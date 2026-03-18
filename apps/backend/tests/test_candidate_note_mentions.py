import unittest
from uuid import uuid4

from app.api.v1.endpoints.candidates import (
    _candidate_note_excerpt,
    _serialize_note_mentions,
)


class CandidateNoteMentionHelpersTests(unittest.TestCase):
    def test_excerpt_compacts_whitespace_and_truncates(self):
        content = "  Hello   team\n\nplease   review this candidate note with extra spacing.  "
        excerpt = _candidate_note_excerpt(content, limit=32)
        self.assertEqual(excerpt, "Hello team please review this…")

    def test_serialize_note_mentions_skips_invalid_rows(self):
        valid_id = str(uuid4())
        mentions = _serialize_note_mentions(
            [
                {"user_id": valid_id, "name": "Harsh", "email": "harsh@onehash.ai"},
                {"user_id": None, "name": "Skip", "email": "skip@onehash.ai"},
                {"user_id": str(uuid4()), "name": "No Email", "email": ""},
            ]
        )

        self.assertEqual(len(mentions), 1)
        self.assertEqual(str(mentions[0].user_id), valid_id)
        self.assertEqual(mentions[0].name, "Harsh")
        self.assertEqual(mentions[0].email, "harsh@onehash.ai")
