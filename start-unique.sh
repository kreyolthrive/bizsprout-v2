PORT="${PORT:-3002}"
PID=$(lsof -tiTCP:$PORT)
[ -n "$PID" ] && kill $PID
sleep 1
pnpm build || exit 1
SKIP_DB="${SKIP_DB:-1}" DISABLE_RATELIMIT="${DISABLE_RATELIMIT:-1}" PORT=$PORT pnpm start
