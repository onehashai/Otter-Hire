#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: $0 <taskdef-family-or-arn> <cluster> <service> <image>" >&2
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

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

aws ecs describe-task-definition \
  --task-definition "$taskdef" \
  --query 'taskDefinition' \
  --output json > "$tmpdir/current.json"

jq --arg image "$image" '
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
' "$tmpdir/current.json" > "$tmpdir/register.json"

new_arn="$(
  aws ecs register-task-definition \
    --cli-input-json "file://$tmpdir/register.json" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
)"

aws ecs update-service \
  --cluster "$cluster" \
  --service "$service" \
  --task-definition "$new_arn" \
  --force-new-deployment \
  --query 'service.taskDefinition' \
  --output text >/dev/null

printf '%s\n' "$new_arn"