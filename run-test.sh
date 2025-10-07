#!/bin/zsh
echo "Killing processes on port 3002..."
lsof -ti :3002 | xargs kill -9 2>/dev/null || true

echo "Building Next.js app..."
pnpm build

echo "Starting server on port 3002..."
pnpm start -p 3002 &
SERVER_PID=$!
sleep 5

echo "Running k6 load test..."
k6 run k6-waitlist.js --env HOST="http://localhost:3002"

echo "Stopping server..."
kill -9 $SERVER_PID
