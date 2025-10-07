lsof -ti :3002 | xargs kill -9 2>/dev/null || true
pnpm build || exit 1
pnpm start -p 3002 > server.log 2>&1 &
SERVER_PID=$!
READY=0
for i in {1..60}; do
  curl -sf "http://localhost:3002/api/ping" >/dev/null && READY=1 && break
  curl -sf "http://localhost:3002/" >/dev/null && READY=1 && break
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "Server failed to become ready on :3002"
  tail -n 120 server.log
  kill -9 $SERVER_PID 2>/dev/null || true
  exit 1
fi
k6 run k6-waitlist.js --env HOST="http://localhost:3002" --summary-export k6-summary.json
EXIT=$?
kill -9 $SERVER_PID 2>/dev/null || true
echo "Done. k6 exit code: $EXIT"
