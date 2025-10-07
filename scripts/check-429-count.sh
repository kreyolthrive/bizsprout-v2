#!/usr/bin/env bash
# fails if no traffic or 429 count > 10
file=${1:-k6-summary.json}

jq -e '
  (.metrics.http_reqs.count // 0) > 0 and
  ((.metrics.status_429.count // 0) <= 10)
' "$file" >/dev/null \
  || { echo "❌ too many 429s (count > 10)"; exit 1; }