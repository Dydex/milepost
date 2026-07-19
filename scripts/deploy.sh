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

# Protocol fee in basis points. Capped at 1000 (10%) by both the registry and
# the programme, so a value above that is refused on-chain rather than here.
FEE_BPS="${FEE_BPS:-250}"

mkdir -p "$OUT_DIR"

if ! stellar keys address "$SOURCE" >/dev/null 2>&1; then
  echo "==> Creating and funding key '$SOURCE' on $NETWORK"
  stellar keys generate --global "$SOURCE" --network "$NETWORK" --fund
fi

DEPLOYER="$(stellar keys address "$SOURCE")"
echo "==> Deployer: $DEPLOYER"

echo "==> Building"
(cd "$ROOT" && stellar contract build)

deploy() {
  local name="$1"; shift
  local wasm="$WASM_DIR/$name.wasm"
  [[ -f "$wasm" ]] || { echo "missing build artifact: $wasm" >&2; exit 1; }
  echo "==> Deploying $name ($(stat -c%s "$wasm") bytes)" >&2
  stellar contract deploy \
    --wasm "$wasm" \
    --source-account "$SOURCE" \
    --network "$NETWORK" \
    "$@"
}

invoke() {
  local id="$1"; shift
  stellar contract invoke \
    --id "$id" \
    --source-account "$SOURCE" \
    --network "$NETWORK" \
    -- "$@" >/dev/null
}

# The order below is a real dependency chain, not a preference.
#
# `record` is deployed with the deployer as admin because the registry's address
# does not exist yet; admin is handed over once it does. That transfer is what
# lets the registry authorise each programme it deploys to write standing.

ATTEST="$(deploy milepost_attest)"
echo "    attest:   $ATTEST"

RECORD="$(deploy milepost_record --admin "$DEPLOYER")"
echo "    record:   $RECORD"

# The registry instantiates programmes from an uploaded wasm hash rather than
# from a deployed instance, so each programme runs its own isolated state.
echo "==> Uploading programme wasm"
PROGRAM_WASM="$(stellar contract upload \
  --wasm "$WASM_DIR/milepost_program.wasm" \
  --source-account "$SOURCE" \
  --network "$NETWORK")"
echo "    programme wasm: $PROGRAM_WASM"

REGISTRY="$(deploy milepost_registry \
  --admin "$DEPLOYER" \
  --treasury "$DEPLOYER" \
  --attest "$ATTEST" \
  --record "$RECORD" \
  --fee_bps "$FEE_BPS" \
  --program_wasm "$PROGRAM_WASM")"
echo "    registry: $REGISTRY"

echo "==> Handing record admin to the registry"
invoke "$RECORD" set_admin --new_admin "$REGISTRY"

cat >"$OUT_FILE" <<EOF
{
  "network": "$NETWORK",
  "deployer": "$DEPLOYER",
  "attest": "$ATTEST",
  "record": "$RECORD",
  "registry": "$REGISTRY",
  "program_wasm": "$PROGRAM_WASM",
  "fee_bps": $FEE_BPS
}
EOF

echo "==> Wrote $OUT_FILE"
cat "$OUT_FILE"
