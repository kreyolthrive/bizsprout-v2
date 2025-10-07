#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3002}"
APP_HOST="http://localhost:${PORT}"

# 1) Restore the landing page if a backup exists
restored=""
for ext in tsx ts jsx js; do
  if [[ -f "pages/index.backup.${ext}" ]]; then
    echo "Restoring pages/index.backup.${ext} -> pages/index.${ext}"
    mv -f "pages/index.backup.${ext}" "pages/index.${ext}"
    restored="yes"
    break
  fi
done
[[ -z "${restored}" ]] && echo "No pages/index.backup.* found — nothing to restore."

# Heads-up if app router index could conflict
if [[ -f "app/page.tsx" || -f "app/page.jsx" || -f "app/page.ts" || -f "app/page.js" ]]; then
  echo "⚠️  app/page.* exists. It can shadow pages/index.*; consider removing/renaming it."
fi

# 2) Free the port
lsof -tiTCP:${PORT} | xargs -r kill -9 2>/dev/null || true
pkill -f "next (start|dev).*-p ${PORT}" 2>/dev/null || true

# 3) Build
pnpm build

# 4) Start (your package.json has: start = 'next start -p $PORT')
SKIP_DB="${SKIP_DB:-0}" \
DISABLE_RATELIMIT="${DISABLE_RATELIMIT:-0}" \
PORT="${PORT}" pnpm start > server.log 2>&1 &
SERVER_PID=$!
echo "Started Next.js (pid ${SERVER_PID}) on ${APP_HOST}"

# 5) Wait until ready
for i in {1..60}; do
  curl -sf "${APP_HOST}/api/ping" >/dev/null && break
  curl -sf "${APP_HOST}/" >/dev/null && break
  sleep 1
done

# 6) Quick smoke checks
echo "— META —"
curl -s "${APP_HOST}/" | egrep -i 'og:title|og:description|twitter:card|<title>|<meta name="description"' || true
echo "— ROBOTS —"
curl -s "${APP_HOST}/robots.txt" | sed -n '1,5p' || true
echo "— SITEMAP —"
curl -s "${APP_HOST}/sitemap.xml" | sed -n '1,6p' || true

echo "Done. Visit ${APP_HOST}"