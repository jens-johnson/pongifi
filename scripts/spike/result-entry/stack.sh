#!/usr/bin/env bash
# Brings up the disposable spike database stack: Postgres 17 plus Neon's wsproxy, both on an isolated
# docker network. Idempotent, and restarts Docker Desktop when its daemon has gone away.
set -euo pipefail

NET=pongifi-spike-net
PG=pg-spike
WS=ws-spike

if ! docker info >/dev/null 2>&1; then
  open -a Docker
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 5
  done
fi

docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null

if ! docker ps --format '{{.Names}}' | grep -qx "$PG"; then
  docker rm -f "$PG" >/dev/null 2>&1 || true
  docker run -d --name "$PG" --network "$NET" \
    -e POSTGRES_PASSWORD=spike -e POSTGRES_USER=spike -e POSTGRES_DB=spike \
    -p 55432:5432 postgres:17-alpine >/dev/null
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$WS"; then
  docker rm -f "$WS" >/dev/null 2>&1 || true
  docker run -d --name "$WS" --network "$NET" \
    -e ALLOW_ADDR_REGEX='.*' -e LOG_TRAFFIC=false \
    -p 55433:80 ghcr.io/neondatabase/wsproxy:latest >/dev/null
fi

for _ in $(seq 1 30); do
  docker exec "$PG" pg_isready -U spike >/dev/null 2>&1 && break
  sleep 1
done

docker exec "$PG" pg_isready -U spike
