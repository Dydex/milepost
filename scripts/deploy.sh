#!/usr/bin/env bash
#
# Build and deploy the Milepost contracts, recording the resulting ids so the
# frontend and the seed script can pick them up.
#
#   ./scripts/deploy.sh [network] [source-account]
#
# Deployed ids land in deployments/<network>.json, which is gitignored — they
# are environment-specific and get regenerated freely.

set -euo pipefail

NETWORK="${1:-testnet}"
SOURCE="${2:-milepost-deployer}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/deployments"
OUT_FILE="$OUT_DIR/$NETWORK.json"
WASM_DIR="$ROOT/target/wasm32v1-none/release"

# Contracts are deployed in dependency order: the standalone primitives first,
# then anything that needs to be told where they live.
CONTRACTS=(milepost_attest)

mkdir -p "$OUT_DIR"

if ! stellar keys address "$SOURCE" >/dev/null 2>&1; then
  echo "==> Creating and funding key '$SOURCE' on $NETWORK"
  stellar keys generate --global "$SOURCE" --network "$NETWORK" --fund
fi

echo "==> Building"
stellar contract build --package-filter "milepost-*" 2>/dev/null || stellar contract build

echo "{" >"$OUT_FILE"
first=1
for name in "${CONTRACTS[@]}"; do
  wasm="$WASM_DIR/$name.wasm"
  [[ -f "$wasm" ]] || { echo "missing build artifact: $wasm" >&2; exit 1; }

  echo "==> Deploying $name ($(stat -c%s "$wasm") bytes)"
  id="$(stellar contract deploy \
    --wasm "$wasm" \
    --source-account "$SOURCE" \
    --network "$NETWORK")"

  echo "    $id"
  [[ $first -eq 1 ]] || echo "," >>"$OUT_FILE"
  first=0
  printf '  "%s": "%s"' "$name" "$id" >>"$OUT_FILE"
done
printf '\n}\n' >>"$OUT_FILE"

echo "==> Wrote $OUT_FILE"
cat "$OUT_FILE"
