#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <repository> <tag-prefix> <keep-count>" >&2
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

repository="$1"
tag_prefix="$2"
keep_count="$3"

images_json="$(
  aws ecr describe-images \
    --repository-name "$repository" \
    --output json
)"

mapfile -t stale_tags < <(
  jq -r \
    --arg prefix "$tag_prefix" \
    --argjson keep "$keep_count" '
      .imageDetails
      | map(select((.imageTags // []) | any(startswith($prefix))))
      | sort_by(.imagePushedAt)
      | reverse
      | .[$keep:]
      | .[]
      | (.imageTags // [])[]
      | select(startswith($prefix))
    ' <<<"$images_json"
)

if [[ ${#stale_tags[@]} -eq 0 ]]; then
  echo "No stale tags found for prefix ${tag_prefix}"
  exit 0
fi

for tag in "${stale_tags[@]}"; do
  aws ecr batch-delete-image \
    --repository-name "$repository" \
    --image-ids "imageTag=${tag}" >/dev/null
  echo "Deleted ${repository}:${tag}"
done
