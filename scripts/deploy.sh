#!/usr/bin/env bash
# Edu Nara — deploy ke Raspberry Pi 5
# Usage: ./scripts/deploy.sh
# Override host/path lewat env: PI_HOST=user@ip PI_PATH=/path ./scripts/deploy.sh

set -euo pipefail

PI_HOST="${PI_HOST:-ishanaracho@10.200.10.5}"
PI_PATH="${PI_PATH:-/DATA/AppData/edu-nara}"

echo "→ Syncing source ke $PI_HOST:$PI_PATH…"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .svelte-kit \
  --exclude build \
  --exclude data \
  --exclude .git \
  --exclude test-results \
  --exclude playwright-report \
  --exclude .env \
  ./ "$PI_HOST:$PI_PATH/"

echo "→ Build & restart di Pi…"
ssh "$PI_HOST" "cd $PI_PATH && docker compose up -d --build"

echo "→ Log 20 baris terakhir:"
ssh "$PI_HOST" "cd $PI_PATH && docker compose logs --tail=20 app"

echo "✓ Selesai."
