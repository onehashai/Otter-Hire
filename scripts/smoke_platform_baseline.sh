#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] Compose config validation"
docker compose config > /dev/null

echo "[2/4] Service status"
docker compose ps

echo "[3/4] Backend lint"
docker compose exec -T backend ruff check app

echo "[4/4] Backend health"
docker compose exec -T backend python - <<'PY'
import urllib.request
print("openapi:", urllib.request.urlopen("http://localhost:8000/openapi.json", timeout=5).status)
PY

echo "platform baseline smoke: OK"
