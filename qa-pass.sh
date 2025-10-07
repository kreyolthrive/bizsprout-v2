set -e
APP_HOST="${APP_HOST:-http://localhost:3002}"
PORT="${PORT:-3002}"
lsof -tiTCP:$PORT | xargs kill -9 2>/dev/null || true
pnpm build
SKIP_DB=1 DISABLE_RATELIMIT=1 PORT=$PORT pnpm start > server.log 2>&1 &
SERVER_PID=$!
READY=0
for i in {1..60}; do
  curl -sf "$APP_HOST/api/ping" >/dev/null && READY=1 && break
  curl -sf "$APP_HOST/" >/dev/null && READY=1 && break
  sleep 1
done
[ "$READY" != "1" ] && tail -n 120 server.log && kill -9 $SERVER_PID && exit 1
curl -si -X POST "$APP_HOST/api/waitlist" -H "content-type: application/json" -d '{"email":"qa@example.com"}' | awk '/^HTTP\/|X-Waitlist-Mode|^\{/{print}'
k6 run -q k6-waitlist-skip.js --env HOST="$APP_HOST" --summary-export k6-summary-skip.json | tee k6-skip.out
oha -z 20s -c 80 "$APP_HOST/" | tee oha.txt
curl -sI -H 'Accept: text/html' "$APP_HOST/" | awk 'BEGIN{IGNORECASE=1}/content-security-policy|x-content-type-options|x-frame-options|referrer-policy|permissions-policy/{print}'
curl -s "$APP_HOST/" | egrep -i "og:title|og:description|twitter:card|<title>|<meta name=\"description\""
curl -s "$APP_HOST/robots.txt" | head -n 5
curl -s "$APP_HOST/sitemap.xml" | head -n 5
kill -9 $SERVER_PID 2>/dev/null || true
echo PASS
