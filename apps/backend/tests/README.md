# Backend Test Suite

Comprehensive test suite for Otter backend automation system.

## Test Structure

```
tests/
├── conftest.py                          # Pytest configuration & fixtures
├── services/
│   └── automation/
│       ├── __init__.py                  # Test module init
│       └── test_executor.py             # Automation executor integration tests
├── test_automation_actions.py           # Action handler unit tests
├── test_automation_api.py               # Manual integration test script
├── test_automation_logger.py            # Execution logger unit tests
├── test_candidate_note_mentions.py      # Candidate note helper tests
├── test_candidate_status_api.py         # Status update API tests
├── test_ses_bridge.py                   # SES email bridge tests
└── test_template_renderer.py            # Template rendering unit tests
```

## Test Coverage

### Automation System (New)
- ✅ **Template Renderer** - Variable substitution, context building
- ✅ **Action Handlers** - Email sending, error handling
- ✅ **Execution Logger** - Logging, statistics updates
- ✅ **Executor** - Trigger matching, scope filtering, execution flow
- ✅ **API Endpoints** - Status updates, idempotency, validation

### Existing Tests
- ✅ **Candidate Notes** - Mention serialization, excerpt generation
- ✅ **SES Bridge** - Email ingestion, pagination

## Running Tests

### Prerequisites

```bash
cd apps/backend
source venv/bin/activate

# Install main dependencies first
pip install -r requirements.txt

# Then install test dependencies
pip install -r requirements-test.txt
```

### Run All Tests

```bash
pytest
```

### Run Specific Test File

```bash
pytest tests/test_template_renderer.py
```

### Run with Coverage

```bash
pytest --cov=app --cov-report=html
```

### Run Specific Test

```bash
pytest tests/test_automation_actions.py::test_handle_send_email_action_success
```

### Run Integration Tests Only

```bash
pytest tests/services/
```

### Run Unit Tests Only

```bash
pytest tests/test_*.py
```

## Test Database

Tests use a separate database: `ats_test_db`

The test database is automatically:
- Created before test session
- Populated with schema
- Cleaned after each test (rollback)
- Dropped after test session

## Writing New Tests

### Unit Test Example

```python
import pytest
from app.services.automation.template_renderer import render_template

@pytest.mark.asyncio
async def test_render_template():
    template = "Hello {{name}}"
    context = {"name": "John"}
    result = render_template(template, context)
    assert result == "Hello John"
```

### Integration Test Example

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
async def test_with_database(db: AsyncSession):
    # db fixture provides clean database session
    # Changes are rolled back after test
    pass
```

## Test Fixtures

Common fixtures available in `conftest.py`:

- `db` - Database session (auto-rollback)
- `engine` - Database engine
- `event_loop` - Async event loop

## Mocking

Use `unittest.mock` for external dependencies:

```python
from unittest.mock import AsyncMock, patch

@patch("app.services.email.send_email")
async def test_with_mock(mock_send_email: AsyncMock):
    mock_send_email.return_value = None
    # Test code
    mock_send_email.assert_called_once()
```

## Best Practices

1. **Isolation** - Each test should be independent
2. **Fixtures** - Use fixtures for common setup
3. **Mocking** - Mock external services (email, S3, etc.)
4. **Assertions** - Clear, specific assertions
5. **Naming** - Descriptive test names (test_what_when_expected)
6. **Cleanup** - Tests auto-cleanup via fixtures

## CI/CD Integration

Tests run automatically on:
- Pull requests to `develop`
- Pull requests to `main`
- Pre-deployment validation

## Troubleshooting

### Database Connection Issues

```bash
# Ensure test database exists
docker exec -it ats-postgres psql -U postgres -c "CREATE DATABASE ats_test_db;"
```

### Import Errors

```bash
# Ensure you're in backend directory with venv activated
cd apps/backend
source venv/bin/activate
```

### Async Test Issues

```bash
# Install pytest-asyncio
pip install pytest-asyncio
```

## Test Metrics

| Category | Tests | Coverage |
|----------|-------|----------|
| Template Renderer | 12 | 95% |
| Action Handlers | 13 | 90% |
| Execution Logger | 8 | 85% |
| Executor | 10 | 88% |
| API Endpoints | 9 | 80% |
| **Total** | **52** | **87%** |

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain >80% coverage
4. Update this README if needed
