import unittest

from app.api.v1.internal.endpoints.candidates import (
    _application_response_value,
    _iter_application_custom_questions,
)


class CandidateApplicationResponsesHelpersTests(unittest.TestCase):
    def test_iter_custom_questions_skips_hidden_and_keeps_required_metadata(self):
        schema = {
            "custom_fields": [
                {
                    "id": "q1",
                    "key": "q1",
                    "label": "Why this role?",
                    "type": "long_text",
                    "visibility": "required",
                },
                {
                    "id": "q2",
                    "key": "q2",
                    "label": "Portfolio",
                    "type": "url",
                    "visibility": "optional",
                },
                {
                    "id": "q3",
                    "key": "q3",
                    "label": "Internal only",
                    "type": "short_text",
                    "visibility": "hidden",
                },
            ]
        }

        items = _iter_application_custom_questions(schema)
        self.assertEqual(
            items,
            [
                ("q1", "Why this role?", "long_text", True),
                ("q2", "Portfolio", "url", False),
            ],
        )

    def test_response_value_normalization_for_common_types(self):
        self.assertEqual(_application_response_value("multi_select", ["A", "B"]), ["A", "B"])
        self.assertEqual(_application_response_value("multi_select", "A"), ["A"])
        self.assertEqual(_application_response_value("yes_no", "yes"), True)
        self.assertEqual(_application_response_value("yes_no", "no"), False)
        self.assertEqual(_application_response_value("number", "42"), 42)
        self.assertEqual(_application_response_value("number", "42.5"), 42.5)
        self.assertEqual(_application_response_value("short_text", " hello "), "hello")
        self.assertIsNone(_application_response_value("short_text", "   "))
        self.assertIsNone(_application_response_value("short_text", None))


if __name__ == "__main__":
    unittest.main()
