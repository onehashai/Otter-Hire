#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 || $# -gt 5 ]]; then
  echo "usage: $0 <taskdef-family-or-arn> <cluster> <service> <image> [register_only|register_and_update]" >&2
  exit 1
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

require_cmd aws
require_cmd jq

taskdef="$1"
cluster="$2"
service="$3"
image="$4"
mode="${5:-register_and_update}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

aws ecs describe-task-definition \
  --task-definition "$taskdef" \
  --query 'taskDefinition' \
  --output json > "$tmpdir/current.json"

jq --arg image "$image" --arg openai "${OPENAI_API_KEY:-}" '
  del(
    .taskDefinitionArn,
    .revision,
    .status,
    .requiresAttributes,
    .compatibilities,
    .registeredAt,
    .registeredBy
  )
  | .containerDefinitions[0].image = $image
  | if ($openai | length) > 0 then
      .containerDefinitions[0].environment =
        (
          ((.containerDefinitions[0].environment // [])
            | map(select(.name != "OPENAI_API_KEY")))
          + [{"name":"OPENAI_API_KEY","value":$openai}]
        )
    else
      .
    end
' "$tmpdir/current.json" > "$tmpdir/register.json"

new_arn="$(
  aws ecs register-task-definition \
    --cli-input-json "file://$tmpdir/register.json" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
)"

if [[ "$mode" == "register_and_update" ]]; then
  aws ecs update-service \
    --cluster "$cluster" \
    --service "$service" \
    --task-definition "$new_arn" \
    --force-new-deployment \
    --query 'service.taskDefinition' \
    --output text >/dev/null
elif [[ "$mode" != "register_only" ]]; then
  echo "invalid mode: $mode (expected register_only or register_and_update)" >&2
  exit 1
fi

printf '%s\n' "$new_arn"