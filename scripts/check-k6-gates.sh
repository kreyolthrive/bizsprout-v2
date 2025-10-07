#!/usr/bin/env bash
set -euo pipefail

SUMMARY="${1:-k6-summary.json}"

# Thresholds (override via env)
: "${MIN_REQS:=100}"
: "${MIN_2XX_RATE:=0.98}"
: "${MAX_5XX_RATE:=0}"
: "${P95_MS:=800}"
: "${MAX_429_RATE:=0.05}"
: "${REQUIRE_429:=0}"

jq -e \
  --argjson min_reqs   "$MIN_REQS" \
  --argjson min2xx     "$MIN_2XX_RATE" \
  --argjson max5xx     "$MAX_5XX_RATE" \
  --argjson p95        "$P95_MS" \
  --argjson max429     "$MAX_429_RATE" \
  --argjson req429     "$REQUIRE_429" '\
  def rate(m): (m.values.rate // m.rate // 0);\
  def val(m; k): (m.values[k] // m[k] // 0);\
  (.metrics.http_reqs.count // 0) >= $min_reqs and\
  (rate(.metrics.status_2xx) >= $min2xx) and\
  (rate(.metrics.status_5xx) <= $max5xx) and\
  (val(.metrics.http_req_duration; "p(95)") <= $p95) and\
  (\
    ($req429 == 1 and (.metrics.status_429.count // 0) > 0 and rate(.metrics.status_429) <= $max429) or\
    ($req429 != 1 and rate(.metrics.status_429) <= $max429)\
  )' "$SUMMARY" >/dev/null || { \
  echo "❌ k6 gates failed. Snapshot:" >&2; \
  jq -r '\
    def rate(m): (m.values.rate // m.rate // 0);\
    def val(m; k): (m.values[k] // m[k] // 0);\
    [\
      "http_reqs=" + ((.metrics.http_reqs.count // 0)|tostring),\
      "2xx_rate="  + (rate(.metrics.status_2xx)|tostring),\
      "5xx_rate="  + (rate(.metrics.status_5xx)|tostring),\
      "429_rate="  + (rate(.metrics.status_429)|tostring) + " (count=" + ((.metrics.status_429.count // 0)|tostring) + ")",\
      "p95_ms="    + (val(.metrics.http_req_duration; "p(95)")|tostring)\
    ] | join("  ")\
  ' "$SUMMARY" >&2; \
  exit 1; \
}

echo "✅ k6 gates passed."