# TypeScript bindings

Generated clients for the Milepost contracts, produced by
`stellar contract bindings typescript` from the built wasm.

These are generated artefacts. Do not hand-edit them — regenerate instead:

```sh
cargo build --target wasm32v1-none --release
for c in attest record registry program policy_spend; do
  stellar contract bindings typescript \
    --wasm "target/wasm32v1-none/release/milepost_${c}.wasm" \
    --output-dir "packages/${c//_/-}" --overwrite
done
```

Deployed contract ids are written to `deployments/<network>.json` by
`scripts/deploy.sh`; the bindings take the id at construction, so the same
package works against any network.
