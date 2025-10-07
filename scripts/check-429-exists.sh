#!/usr/bin/env bash
# fails if no 429s present
file=${1:-k6-summary.json}

jq -e '
  (.metrics.http_reqs.count // 0) > 0 and
  ((.metrics.status_429.count // 0) > 0)
' "$file" >/dev/null \
  || { echo "❌ expected at least one 429 but saw none"; exit 1; }