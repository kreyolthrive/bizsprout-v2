APP_HOST="${APP_HOST:-http://localhost:3002}"
PORT="${PORT:-3002}"
SKIP_DB="${SKIP_DB:-1}"
DISABLE_RATELIMIT="${DISABLE_RATELIMIT:-1}"

lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
pnpm build || exit 1
SKIP_DB=$SKIP_DB DISABLE_RATELIMIT=$DISABLE_RATELIMIT pnpm start -p $PORT > server.log 2>&1 &
SERVER_PID=$!

READY=0
for i in {1..60}; do
  curl -sf "$APP_HOST/api/ping" >/dev/null && READY=1 && break
  curl -sf "$APP_HOST/" >/dev/null && READY=1 && break
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "Server failed to become ready on :$PORT" | tee -a qa.log
  tail -n 120 server.log | tee -a qa.log
  kill -9 $SERVER_PID 2>/dev/null || true
  exit 1
fi
echo "server ready pid=$SERVER_PID" | tee qa.log

ps -o pid,rss,etime,command -p $SERVER_PID | tee mem-start.txt

curl -s -o /dev/null -w "%{http_code}\n" -X POST "$APP_HOST/api/waitlist" -H "content-type: application/json" --data-binary '{bad' | tee status-invalid-json.txt
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$APP_HOST/api/waitlist" -H "content-type: application/json" -d '{"email":"ok@example.com"}' | tee status-valid.txt
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST "$APP_HOST/api/waitlist" -H "content-type: application/json" -d "{\"email\":\"loop+$RANDOM@example.com\"}"; done | sort | uniq -c | tee status-10.txt

oha -z 30s -c 100 "$APP_HOST/" | tee oha-home.txt
hey -z 30s -c 200 "$APP_HOST/" | tee hey-home.txt
oha -z 20s -c 200 "$APP_HOST/api/ping" | tee oha-ping.txt

k6 run k6-waitlist.js --env HOST="$APP_HOST" --summary-export k6-summary.json

curl -sI -H 'Accept: text/html' "$APP_HOST/" | awk 'BEGIN{IGNORECASE=1}/content-security-policy|x-content-type-options|x-frame-options|referrer-policy|permissions-policy|cache-control/{print}' | tee headers.txt
curl -s "$APP_HOST/" | egrep -i "og:title|og:description|twitter:card|<title>|<meta name=\"description\"" | tee meta.txt
curl -s "$APP_HOST/robots.txt" | tee robots.txt
curl -s "$APP_HOST/sitemap.xml" | tee sitemap.xml
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS "$APP_HOST/api/waitlist" -H "Origin: https://example.com" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type" | tee cors-preflight.txt

for i in {1..30}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST "$APP_HOST/api/waitlist" -H "content-type: application/json" -d "{\"email\":\"burst+$RANDOM@example.com\"}"; done | sort | uniq -c | tee rate-limit.txt

hey -z 2m -c 50 "$APP_HOST/" | tee soak-home.txt

ps -o pid,rss,etime,command -p $SERVER_PID | tee mem-end.txt

kill -9 $SERVER_PID 2>/dev/null || true
echo "artifacts written: server.log, qa.log, *.txt, k6-summary.json"
