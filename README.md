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
| `policy_spend` | Policy signer restricting a smart wallet to verified payees. | Built |
| `treasury` | Multisig over protocol fees. | Planned |

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

## Working in this repo

Contracts and the web app share one repository, and more than one person works
in it at a time. Two conventions keep that from costing anything:

**Paths have owners.** `contracts/`, `crates/` and `scripts/` are the protocol;
`frontend/` is the web app. `packages/` and `deployments/` are generated — the
protocol writes them, the web app reads them, nobody edits them by hand.

**No history rewrites on `main`.** Rebasing, resetting or cherry-picking a
shared branch silently drops commits that were not part of the rewrite. That has
already cost one contract commit here, recovered from the reflog. Merge forward;
do not rewrite behind.

**Re-sync after a contract change.** Bindings in `packages/` encode the contract
interface at the moment they were generated. A stale binding fails at runtime
with a decode error rather than at build time, so regenerate them whenever a
contract interface moves.

## Development

Requires Rust stable with the `wasm32v1-none` target and `stellar` CLI 27.x.

```sh
cargo test                  # contract unit tests
cargo clippy --all-targets -- -D warnings
stellar contract build      # optimised wasm
./scripts/deploy.sh testnet # build, deploy, record ids in deployments/
```

## Status

Phases 0–4 are done: 121 tests, five contracts building to wasm, and an
end-to-end route from contribution through application, review, partial award,
attestation-gated release, fee settlement, refunds and restricted spending.

A tranche releases only when the attestation registry confirms the claim is
valid, is about this recipient, is under this programme's schema, and really was
signed by a verifier the programme trusts. One proof unlocks exactly one
tranche. Whatever is never released — unawarded budget or tranches nobody
claimed — goes back to contributors proportionally once the release window
closes, and only genuinely abandoned funds are swept afterwards.

## Deployed (testnet)

| Contract | Id |
| --- | --- |
| `attest` | `CCL5WBJZK225GAB7YTFNQIFQ62CK5BWDE5SZPDX4KWNJLSUNAUIJVMMG` |
| `record` | `CDQKT2ENYZ5MK7VGQ4QAFQMV7XQ4ICDLY6IB6WBWYPWL6KGFU42D3U5B` |
| `policy_spend` | `CCTOHUSJDJPRWSJ3LJICLQB7PKYERNHZ2WSRHKN6IBTNBSF6HFA2DOWR` |
| `registry` | `CAO72MYVQ2BUI3VUN3MQVGLRQT4ARBIJELJRVJH2F3BDMRMMJYRDYNP6` |

Programmes are instantiated from wasm hash
`dfd9df3ee8a30c2f5f6e4eae498802431c732df9886b2325dd54bc922c64cc8e`, so each one
gets its own address and isolated state. Re-running `./scripts/deploy.sh
testnet` deploys a fresh set rather than upgrading these.

## Seeding a scenario

`scripts/seed.sh` drives a real scenario against a deployed set, so there is
something to look at other than empty state:

```sh
./scripts/deploy.sh testnet    # contracts
./scripts/seed.sh testnet      # programme, funding, two applications
./scripts/seed-review.sh testnet   # once the application window closes
```

It runs in two halves because the programme's phases are driven by wall-clock
deadlines, and the review stage genuinely cannot happen until applications
close. The scenario is chosen to exercise the cases that matter:

- **Two applicants asking for very different amounts** — 500 and 80. An equal
  split would serve neither.
- **Reviewers who disagree** — 300 / 100 / 500 for the same applicant, settling
  at the median rather than being dragged to either extreme.
- **Both restriction models** — one award `Allocated` so the recipient directs
  it to a verified school, one `Direct` straight to the institution.
- **A real attestation** under a restricted schema, so only the clinic can make
  the claim that unlocks a tranche.

Ids and accounts land in `deployments/<network>.seed.json`.

## TypeScript bindings

`packages/` holds generated clients for each contract, produced by
`stellar contract bindings typescript` from the built wasm. Regenerate them
whenever a contract interface changes:

```sh
stellar contract bindings typescript \
  --wasm target/wasm32v1-none/release/milepost_program.wasm \
  --output-dir packages/program --overwrite
```

They are checked in so a frontend can build against the current interface
without first building the contracts.

## Not yet done

- **Treasury multisig.** Fees and swept funds currently go to a single address.
- **Indexer.** Events carry everything needed to reconstruct listings, but
  nothing consumes them yet.
- **Restricted mode end to end.** `policy_spend` is built and tested, but
  wiring a released tranche into a passkey wallet that has the policy installed
  is not yet exercised as one flow.

## Licence

Apache-2.0
