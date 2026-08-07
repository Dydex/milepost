# Contributing to Milepost

Welcome, and thank you for your interest in contributing to Milepost! This guide covers everything you need to go from a clean checkout to an open pull request: local setup, running checks, documentation standards, and the issue workflow.

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Local Setup](#2-local-setup)
3. [Running Frontend Checks](#3-running-frontend-checks)
4. [Running Contract Checks](#4-running-contract-checks)
5. [Documentation Standards](#5-documentation-standards)
6. [Issue and PR Workflow](#6-issue-and-pr-workflow)
7. [Error Code Stability Policy](#7-error-code-stability-policy)

---

## 1. Prerequisites

| Tool | Minimum version | Notes |
| :--- | :--- | :--- |
| Node.js | 18+ | 22 is recommended for CI alignment |
| npm | 8+ | Do not use pnpm or yarn — it creates lockfile conflicts |
| Rust + Cargo | stable (1.74+) | Install via [rustup.rs](https://rustup.rs/) |
| wasm32-unknown-unknown | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | 21+ | [Installation guide](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup) |
| Freighter wallet | latest | [freighter.app](https://www.freighter.app/) — browser extension for UI testing |

---

## 2. Local Setup

**Clone and install**
```bash
git clone https://github.com/milepost-labs/milepost.git
cd milepost

# Install frontend dependencies
cd frontend
npm install
cd ..
```

**Environment variables**
Create `frontend/.env.local` with your local or testnet configurations. Example:
```env
VITE_NETWORK=testnet
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

**Start the development server**
```bash
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173/) to view the app.

---

## 3. Running Frontend Checks

All checks must pass before opening a PR. Run them from the `frontend/` directory:

```bash
# Lint the codebase
npm run lint

# Build for production
npm run build
```

**Architecture note:** The frontend is built with React, Vite, and TypeScript. We utilize a custom CSS-variable design system in `index.css`. Please ensure any new components adhere to the existing slate/navy aesthetic rather than introducing new localized colors.

---

## 4. Running Contract Checks

Milepost's Soroban contracts are structured as a workspace in the root directory (e.g., `contracts/attest`, `contracts/program`, `contracts/registry`, etc.). 

Run these checks from the **root** of the repository:

```bash
# Format check
cargo fmt --all --check

# Lint
cargo clippy --workspace -- -D warnings

# Unit tests
cargo test --workspace
```

To build the WASM artifacts for deployment:
```bash
stellar contract build
```
The compiled outputs will land in `target/wasm32-unknown-unknown/release/`.

---

## 5. Documentation Standards

* **Code comments:** Only add a comment when the *why* is non-obvious — a hidden constraint, a subtle invariant, or a workaround for a specific bug. Do not comment on what the code does; well-named identifiers already do that.
* **Contract interface changes:** Any change that touches the contract state or upgrade flow must be explicitly documented. Breaking changes require an explicit version bump and testnet verification before the PR can be merged.

---

## 6. Issue and PR Workflow

**Picking up an issue**
1. Comment on the issue to let others know you are working on it.
2. Fork the repository and clone your fork.
3. Create a branch from `main` using the convention below.

**Branch naming convention:**
`<type>/<short-description>`
Examples:
* `feat/verifier-dashboard`
* `fix/tranche-unlock-logic`
* `docs/contributing-guide`

**Commit messages**
Write imperative-mood subject lines under 72 characters. Put context in the body when needed.
> feat: add full-screen layout to the landing page
> Replaces the centered hero section with a split-screen design.

**Pull request checklist**
Before marking a PR ready for review:
* `npm run lint` passes
* `npm run build` succeeds
* Contract checks pass if Rust files were touched (`cargo fmt`, `cargo clippy`, `cargo test`)
* PR description references the issue number(s) with `Closes #<number>`

---

## 7. Error Code Stability Policy

If you are modifying the Soroban smart contracts, error codes are part of the contract's public API and are matched on by SDK consumers and off-chain monitoring tools.

**Rules**
1. **Never reassign a published discriminant.** Once an error code has been included in a release, that numeric value is permanently reserved — even if the corresponding variant is removed.
2. **Mark removed variants as reserved.** Replace a deleted variant with an underscored placeholder and annotate it with a `// (reserved — removed variant)` comment. This makes the gap self-documenting and prevents accidental reuse.
3. **Always assign new variants the next available integer.** Do not insert variants mid-sequence; append them at the end of the enum.

Why this matters: Stellar contract error codes propagate as `u32` values in the transaction result. If we reused a previously published discriminant, an indexer or bot that matches on that numeric value could silently misinterpret a new error as an old, unrelated one.
