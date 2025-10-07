#!/usr/bin/env bash
set -euo pipefail

# 1) Restore the real landing page from the backup
for ext in tsx ts jsx js; do
  if [ -f "pages/index.backup.$ext" ]; then
    echo "Restoring pages/index.backup.$ext -> pages/index.$ext"
    mv -f "pages/index.backup.$ext" "pages/index.$ext"
    break
  fi
done

# 2) Make sure the server port is free
PORT=3002
lsof -tiTCP:$PORT | xargs -r kill -9

# 3) Rebuild + start in production
pnpm build
PORT=$PORT pnpm start &
SERVER_PID=$!

# 4) Wait until it’s serving
APP_HOST="http://localhost:$PORT"
for i in {1..60}; do
  curl -sf "$APP_HOST/" >/dev/null && break
  sleep 1
done

# 5) Quick smoke checks
echo "— META —"
curl -s "$APP_HOST/" | egrep -i "og:title|og:description|twitter:card|<title>|<meta name=\"description\""
echo "— ROBOTS —"
curl -s "$APP_HOST/robots.txt" | sed -n '1,5p'
echo "— SITEMAP —"
curl -s "$APP_HOST/sitemap.xml" | sed -n '1,6p'