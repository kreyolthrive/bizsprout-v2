#!/usr/bin/env bash
# combined k6 summary: print rates and hard-gate regression
file=${1:-k6-summary.json}

echo "— k6 summary checks —"

jq -r '
  def rate(m): (m.values.rate // m.rate // 0);
  "2xx=" + ((rate(.metrics.status_2xx)*100)|tostring) + "%  " +
  "5xx=" + ((rate(.metrics.status_5xx)*100)|tostring) + "%  " +
  "429=" + ((rate(.metrics.status_429)*100)|tostring) + "%"
' "$file"

# hard gate regression
jq -e '
  def rate(m): (m.values.rate // m.rate // 0);
  def p95s(t): (t.values["p(95)"] // t["p(95)"] // 0);
  ((rate(.metrics.status_5xx)) == 0) and
  ((rate(.metrics.status_2xx)) > 0.98) and
  (p95s(.metrics.http_req_duration) < 0.8)
' "$file" >/dev/null \
  || { echo "❌ regression: 5xx>0 or 2xx<=98% or p95>=800ms"; exit 1; }

echo "✅ k6 summary checks passed"