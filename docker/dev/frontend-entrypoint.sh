#!/bin/sh
set -eu

cd /app

if [ -f package.json ]; then
  npm install
  exec npm run dev -- --host 0.0.0.0 --port 5173
else
  exec node /opt/frontend/placeholder-server.mjs
fi
