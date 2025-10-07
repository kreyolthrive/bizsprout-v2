#!/usr/bin/env bash
# prints 2xx/5xx/429 rates as percentages (defaults to 0 if absent)
file=${1:-k6-summary.json}

jq -r '
  def rate(m): (m.values.rate // m.rate // 0);
  "2xx=" + ((rate(.metrics.status_2xx)*100)|tostring) + "%  " +
  "5xx=" + ((rate(.metrics.status_5xx)*100)|tostring) + "%  " +
  "429=" + ((rate(.metrics.status_429)*100)|tostring) + "%"
' "$file"
