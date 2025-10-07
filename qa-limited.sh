#!/usr/bin/env bash
set -e

# Kill any running server on port 3002
PID=$(lsof -tiTCP:3002)
[ -n "$PID" ] && kill $PID

# Build the project
pnpm build

# Start server with full DB and rate limits, logging to server-limited.log
LOG_LEVEL=debug SKIP_DB=0 DISABLE_RATELIMIT=0 PORT=3002 pnpm start > server-limited.log 2>&1 &
SERVER_PID=$!

# Give the server a moment to start
sleep 3

# Run load test against waitlist endpoint
k6 run -q k6-waitlist.js --env HOST="http://localhost:3002" --summary-export k6-summary-limited.json | tee k6-limited.out

# Inspect last 200 log lines for key rate-limit behaviors
tail -n 200 server-limited.log | egrep '"msg":"(insert-ok|dedupe|rate-limited|db-error)"'

# Cleanup
kill $SERVER_PID 2>/dev/null || true
