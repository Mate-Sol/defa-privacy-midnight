#!/usr/bin/env bash
# One-command demo bring-up for DeFa × Midnight Wave-1.
#
#   npm run demo
#
# Compiles the contract if needed, starts the local standalone stack, deploys a
# pool (with a real owner, so the admin yield control works), points the FE at
# it, and starts the dev server. Chain state persists across Docker restarts.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

say "1/5  Checking prerequisites"
command -v docker >/dev/null || die "docker not found"
docker info >/dev/null 2>&1 || die "Docker daemon isn't running — start Docker Desktop and retry"
echo "  docker present"

say "2/5  Compiling the contract (if artifacts are missing)"
if [ -d contract/src/managed/ConfidentialCreditPool/keys ]; then
  echo "  artifacts already present — skipping"
else
  command -v compact >/dev/null || die "compact CLI not found (see README → Toolchain)"
  (cd contract && npm run compact)
fi

say "3/5  Starting the standalone stack (node :9944, indexer :8088, proof :6300)"
(cd bboard-cli && docker compose -f compose-standalone.yml up -d)
for i in $(seq 1 40); do
  sleep 3
  if curl -sf --max-time 4 http://127.0.0.1:9944/health >/dev/null 2>&1; then break; fi
  [ "$i" -eq 40 ] && die "node never became healthy"
done
echo "  stack up"

say "4/5  Starting the local dev wallet (syncs, then deploys a pool it owns)"
# The portal's buttons sign through this process while Lace can't pay fees on
# this stack. It writes client/.env.local (contract + dev wallet URL) when ready.
DEV_LOG="$ROOT/bboard-cli/dev-wallet.log"
pkill -f "src/dev-wallet-server.ts" 2>/dev/null || true
(cd bboard-cli && nohup npx tsx src/dev-wallet-server.ts > "$DEV_LOG" 2>&1 &)
ST=""
for i in $(seq 1 200); do
  sleep 3
  ST=$(curl -sf --max-time 3 http://127.0.0.1:5301/status || true)
  case "$ST" in
    *'"ready":true'*) break ;;
    *'"phase":"error"'*) tail -20 "$DEV_LOG"; die "dev wallet failed to start" ;;
  esac
  [ "$i" -eq 200 ] && { tail -20 "$DEV_LOG"; die "dev wallet never became ready"; }
done
ADDR=$(printf '%s' "$ST" | grep -oE '"contractAddress":"[0-9a-f]+"' | cut -d'"' -f4)
echo "  contract:   $ADDR"
echo "  dev wallet: http://127.0.0.1:5301  (log: bboard-cli/dev-wallet.log)"

say "5/5  Starting the FE"
cat <<TXT

  Point Lace at this stack, then connect:
    node          http://127.0.0.1:9944
    indexer       http://127.0.0.1:8088
    proof server  http://127.0.0.1:6300

  FE:  http://127.0.0.1:5201  → click "Use local dev wallet"
  Stop the dev wallet:  pkill -f dev-wallet-server.ts
  Stop the stack:  cd bboard-cli && docker compose -f compose-standalone.yml down
  (add -v only if you WANT to wipe the chain)

TXT
cd client && npm run dev -- --port 5201 --strictPort --host 127.0.0.1
