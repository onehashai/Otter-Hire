#!/usr/bin/env bash
set -euo pipefail

# Guardrail checks for integrations modular architecture.

fail() {
  echo "[guard:fail] $1" >&2
  exit 1
}

search_cmd() {
  if command -v rg >/dev/null 2>&1; then
    rg -n "$1" "$2"
  else
    grep -R -n -E "$1" "$2"
  fi
}

echo "[1/5] verify legacy org inbox backend routes are removed"
if search_cmd '@router\.(get|post|put|patch|delete)\("/me/inbox' apps/backend/app/api/v1/endpoints/organizations.py >/dev/null; then
  fail "legacy /organizations/me/inbox routes still present"
fi

echo "[2/5] verify frontend does not call legacy org inbox endpoints"
if search_cmd '/organizations/me/inbox' apps/web/src >/dev/null; then
  fail "legacy org inbox frontend API usage still present"
fi

echo "[3/5] verify integrations registry exists"
test -f apps/backend/app/integrations/app_store/registry.py || fail "missing registry.py"

echo "[4/5] verify email integration feature module exists"
test -f apps/web/src/features/integrations/app-store/email-integration/EmailIntegrationManager.tsx || fail "missing EmailIntegrationManager feature module"

echo "[5/5] verify integrations settings uses feature module"
search_cmd 'EmailIntegrationManager' 'apps/web/src/app/(app-page-wrapper)/settings/integrations/page.tsx' >/dev/null \
  || fail "integrations page is not using EmailIntegrationManager"

echo "integrations architecture guard: OK"
