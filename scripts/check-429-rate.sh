#!/usr/bin/env bash
# fails if 429 rate exceeds 5%
file=${1:-k6-summary.json}

jq -e '
  def rate(m): (m.values.rate // m.rate // 0);
  (rate(.metrics.status_429) <= 0.05)
' "$file" >/dev/null \
  || { echo "❌ too many 429s (>5%)"; exit 1; }