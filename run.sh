#!/bin/bash
# Starts the API (:4000) and web app (:3100).
set -eu
cd "$(dirname "$0")"

if ! command -v lsof >/dev/null || ! command -v curl >/dev/null; then
  echo "This script requires lsof and curl." >&2
  exit 1
fi

for port in 4000 3100; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use; stop its owner before starting Civic Lens." >&2
    exit 1
  fi
done

api_pid=
web_pid=
cleanup() {
  for pid in "$web_pid" "$api_pid"; do
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT
trap 'exit 130' INT TERM

if [ -f .env ]; then
  (cd apps/api && exec node --import tsx --env-file=../../.env src/server.ts) &
else
  (cd apps/api && exec node --import tsx src/server.ts) &
fi
api_pid=$!

ready=false
for i in $(seq 1 30); do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "API exited before becoming ready." >&2
    exit 1
  fi
  if curl -s -o /dev/null http://localhost:4000/v1/zip/97229; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo "API did not become ready on port 4000." >&2
  exit 1
fi

echo "API is up on :4000"
(cd apps/web && exec ../../node_modules/.bin/next dev -p 3100) &
web_pid=$!
echo "Open http://localhost:3100  (Ctrl+C stops Civic Lens)"
wait "$web_pid"
