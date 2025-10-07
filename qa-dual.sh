APP_HOST="${APP_HOST:-http://localhost:3002}"
PORT="${PORT:-3002}"

run_phase () {
  PHASE="$1"; SKIP_DB="$2"; DISABLE_RL="$3"
  PID=$(lsof -tiTCP:$PORT); [ -n "$PID" ] && kill $PID
  pnpm build || exit 1
  SKIP_DB=$SKIP_DB DISABLE_RATELIMIT=$DISABLE_RL PORT=$PORT pnpm start > "server-$PHASE.log" 2>&1 &
  SERVER_PID=$!
  READY=0
  for i in {1..60}; do
    curl -sf "$APP_HOST/api/ping" >/dev/null && READY=1 && break
    curl -sf "$APP_HOST/" >/dev/null && READY=1 && break
    sleep 1
  done
  [ "$READY" != "1" ] && tail -n 120 "server-$PHASE.log" && kill -9 $SERVER_PID && exit 1
  k6 run k6-waitlist.js --env HOST="$APP_HOST" --summary-export "k6-summary-$PHASE.json"
  oha -z 30s -c 100 "$APP_HOST/" | tee "oha-$PHASE.txt"
  kill -9 $SERVER_PID 2>/dev/null || true
}

run_phase raw 1 1
run_phase limited 0 0

echo "Artifacts: k6-summary-raw.json, k6-summary-limited.json, oha-raw.txt, oha-limited.txt, server-raw.log, server-limited.log"
