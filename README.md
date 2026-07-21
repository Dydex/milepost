# Milepost

*A milepost marks how far along the road you have come.*

Conditional disbursement infrastructure on Stellar. A funder commits money to a
programme; recipients receive it in tranches that unlock only when a trusted
verifier attests that a condition was met; and each release leaves behind a
portable record the next funder can underwrite against.

Money moves at each milepost, and only at each milepost.

## The problem this is actually solving

Most on-chain grant tooling stops at *selection*: it makes the vote transparent,
transfers a lump sum, and ends. The unsolved part is everything after the
transfer — did the money reach the person, could they spend it on the thing it
was for, and can anyone prove it afterwards.

That gap is why Milepost is built on Stellar rather than an EVM chain:

- **Anchors and SEP-24/SEP-31 off-ramps** mean a recipient can turn value into a
  bank balance or mobile money. Without this the rest is theatre.
- **Fee sponsorship** means recipients never hold XLM and donors are not priced
  out of small contributions.
- **Passkey smart wallets** mean onboarding without a seed phrase.
- **Policy signers** mean a tranche can land in the recipient's own wallet while
  still being spendable only to verified payees. This is the piece no EVM chain
  does cleanly, and it is what turns "we sent the money" into "we can show what
  it became".

## Not an education protocol

Education is the first vertical and the demo scenario, not the design. The
contracts carry no domain vocabulary — a *verifier* attests a *condition* about
a *recipient*, and what that means is set per programme:

| Vertical | Verifier | Condition | Payee |
| --- | --- | --- | --- |
| Education | School | Enrolment, term completed | Institution |
| Health workers | Clinic | Shifts worked | Recipient, unrestricted |
| Agriculture | Co-operative | Harvest delivered | Input supplier |
| Vocational | Training provider | Course completed | Recipient, restricted |
| Humanitarian | Field officer | Household verified | Verified vendors |
| SME microgrants | Programme officer | Milestone met | Mixed |

## Contracts

| Crate | Role | Status |
| --- | --- | --- |
| `attest` | Schema-based attestation registry. Standalone; Soroban has no EAS equivalent. | Built |
| `record` | Portable, non-transferable recipient standing. | Built |
| `registry` | Factory and protocol configuration. | Built |
| `program` | A funding programme: contributions, applications, review, partial awards. | Built |
| `treasury` | Multisig over protocol fees. | Phase 3 |
| `policy_spend` | Policy signer restricting a smart wallet to verified payees. | Phase 4 |

`attest`, `record` and `policy_spend` are deliberately free of any dependency on
the rest of the protocol, and are intended to be useful to other teams on their
own.

## Design notes worth knowing before reading the code

**No on-chain collections.** Nothing accumulates a list inside a single ledger
entry. Growing entries cost more to write over time and eventually become
expensive to restore after archival. Listing is served off-chain from events;
on-chain code verifies specific ids.

**Archival is a design input, not an afterthought.** Persistent entries carry
explicit TTL extensions, and `keepalive` is permissionless so a recipient's proof
does not rot because the issuer lost interest. Short-lived state — review votes,
for instance — uses temporary storage and is allowed to expire once tallied.

**No sentinel values in money paths.** `Option<T>` over magic numbers. The
ledger timestamp is genuinely `0` early in a test network's life, which is
exactly the kind of thing that turns a `0`-means-absent convention into a bug.

**No hard dependency on a pinning service.** Payload hashes go on-chain; the
payload itself lives wherever the parties agree. Creating a programme must never
fail because an IPFS gateway is down.

## Development

Requires Rust stable with the `wasm32v1-none` target and `stellar` CLI 27.x.

```sh
cargo test                  # contract unit tests
cargo clippy --all-targets -- -D warnings
stellar contract build      # optimised wasm
./scripts/deploy.sh testnet # build, deploy, record ids in deployments/
```

## Status

Early, but the money path exists. Phases 0–2 are done: 77 tests, four contracts
building to wasm, and an end-to-end route from contribution through application,
review and partial award.

Phase 3 is what makes it Milepost rather than another grants app — tranches that
release only against a valid attestation, and the refund and recycle paths for
money that is never claimed.

## Licence

Apache-2.0
