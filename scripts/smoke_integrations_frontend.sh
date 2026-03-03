#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:8000}"
EMAIL="${EMAIL:-harsh@onehash.ai}"
PASSWORD="${PASSWORD:-Harsh@1234}"
COOKIE="${COOKIE:-/tmp/ats_phase5_cookie.txt}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

require_cmd curl
require_cmd jq

login_payload=$(jq -nc --arg email "$EMAIL" --arg password "$PASSWORD" '{email:$email,password:$password}')

echo "[1/5] Login"
curl -sS -c "$COOKIE" -H "Content-Type: application/json" -d "$login_payload" "$BASE/auth/login" >/dev/null

echo "[2/5] Integrations apps endpoint"
apps_json=$(curl -sS -b "$COOKIE" "$BASE/integrations/apps")
echo "$apps_json" | jq '.items | length' >/dev/null
echo "$apps_json" | jq -e '.items[] | select(.slug == "email-integration")' >/dev/null

echo "[3/5] Integrations installed endpoint"
installed_json=$(curl -sS -b "$COOKIE" "$BASE/integrations/installed")
echo "$installed_json" | jq '.items | length' >/dev/null

echo "[4/5] Email integration config endpoint"
config_json=$(curl -sS -b "$COOKIE" "$BASE/integrations/email/config")
echo "$config_json" | jq -e '.app_id == "email_integration"' >/dev/null

echo "[5/5] Frontend routes"
for url in \
  "http://app.localhost:3000/settings/integrations" \
  "http://app.localhost:3000/settings/organization?tab=careers"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [[ "$code" != "200" && "$code" != "307" && "$code" != "308" ]]; then
    echo "unexpected status $code for $url" >&2
    exit 1
  fi
done

echo "integrations frontend smoke: OK"
