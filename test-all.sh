#!/bin/zsh
set -e
APP_HOST="http://localhost:3002"
lsof -ti :3002 | xargs kill -9 2>/dev/null || true
pnpm build
pnpm start -p 3002 > server.log 2>&1 &
SERVER_PID=$!
READY=0
for i in {1..60}; do
  curl -sf "$APP_HOST/api/ping" >/dev/null && READY=1 && break
  curl -sf "$APP_HOST/" >/dev/null && READY=1 && break
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "Server failed to become ready on :3002"
  tail -n 120 server.log
  kill -9 $SERVER_PID 2>/dev/null || true
  exit 1
fi

oha -z 30s -c 50 "$APP_HOST/" | tee oha_home.txt
hey -z 30s -c 100 "$APP_HOST/" | tee hey_home.txt

k6 run k6-waitlist.js --env HOST="$APP_HOST" --summary-export k6-summary.json

curl -sI "$APP_HOST/" | tee headers_home.txt

pnpm dlx @lhci/cli autorun --collect.url="$APP_HOST/" --upload.target=filesystem | tee lhci.txt

if command -v docker >/dev/null 2>&1; then
  docker run --rm -t -v "$PWD:/zap/wrk" owasp/zap2docker-stable zap-baseline.py -t "$APP_HOST" -r zap-report.html || true
fi

kill -9 $SERVER_PID 2>/dev/null || true
echo "Done. Artifacts: server.log, oha_home.txt, hey_home.txt, k6-summary.json, headers_home.txt, lhci.txt, zap-report.html"
