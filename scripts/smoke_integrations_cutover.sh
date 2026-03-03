#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:8000}"
EMAIL="${EMAIL:-harsh@onehash.ai}"
PASSWORD="${PASSWORD:-Harsh@1234}"
COOKIE="${COOKIE:-/tmp/ats_phase8_cookie.txt}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

require_cmd curl
require_cmd jq

login_payload=$(jq -nc --arg email "$EMAIL" --arg password "$PASSWORD" '{email:$email,password:$password}')

echo "[1/7] Login"
curl -sS -c "$COOKIE" -H "Content-Type: application/json" -d "$login_payload" "$BASE/auth/login" >/dev/null

echo "[2/7] Integrations apps"
curl -sS -b "$COOKIE" "$BASE/integrations/apps" | jq -e '.items[] | select(.slug == "email-integration")' >/dev/null

echo "[3/7] Integrations installed"
curl -sS -b "$COOKIE" "$BASE/integrations/installed" | jq '.items | length' >/dev/null

echo "[4/7] Email config"
curl -sS -b "$COOKIE" "$BASE/integrations/email/config" | jq -e '.app_id == "email_integration"' >/dev/null

echo "[5/7] Legacy org inbox route removed"
legacy_status=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" "$BASE/organizations/me/inbox")
if [[ "$legacy_status" != "404" ]]; then
  echo "expected 404 for legacy org inbox route, got $legacy_status" >&2
  exit 1
fi

echo "[6/7] Integrations UI route reachable"
ui_status=$(curl -s -o /dev/null -w "%{http_code}" "http://app.localhost:3000/settings/integrations")
if [[ "$ui_status" != "200" && "$ui_status" != "307" && "$ui_status" != "308" ]]; then
  echo "unexpected status $ui_status for integrations UI" >&2
  exit 1
fi

echo "[7/7] Legacy deep-link route still reachable for redirect"
legacy_ui_status=$(curl -s -o /dev/null -w "%{http_code}" "http://app.localhost:3000/settings/organization?tab=careers")
if [[ "$legacy_ui_status" != "200" && "$legacy_ui_status" != "307" && "$legacy_ui_status" != "308" ]]; then
  echo "unexpected status $legacy_ui_status for legacy deep-link UI" >&2
  exit 1
fi

echo "[guard] Architecture guard"
scripts/verify_integrations_architecture.sh

echo "integrations cutover smoke: OK"
