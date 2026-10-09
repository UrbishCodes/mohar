# 🪙 Mohar — मोहर

**Sealed. Settled. Paid.**

On-chain escrow for freelancers working with international clients. The client locks USDC, the freelancer delivers, funds move when the deal does. No custodian, no platform cut, no _"I'll pay you next week"_.

**Live on Solana devnet:** [Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ](https://explorer.solana.com/address/Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ?cluster=devnet)

---

## 😤 The problem

Cross-border freelance work runs on trust. The client sends a deposit, or they don't. The freelancer starts the work, or they don't. When something goes wrong — late payment, ghosted client, disputed scope — the freelancer has no leverage. Marketplaces take a cut and resolve disputes slowly. Direct-client work, where margins are best, has no protection at all.

Mohar replaces that trust gap with a program.

## 🔒 How it works

The client creates an escrow and locks USDC into a program-owned vault. The freelancer and an arbiter are named on the escrow, on chain, up front. From there:

```
                        Funded
                          |
          refund          |          mark_delivered
     (client, before      |          (freelancer)
      delivery)           |
                          v
             Refunded  Delivered ---- release ---->  Released
                          |            (client)
                          |
                          +--- raise_dispute ---->  Disputed
                          |    (either side)          |
                          |                           | resolve_dispute
                          |                           | (arbiter)
                          |                           v
                          |                       Resolved
                          |
                          +--- claim_after_deadline --->  Released
                              (freelancer, deadline passed,
                               client silent)
```

Every transition is a program instruction. Every state change is on-chain. There is no off-chain escrow database — the program is the source of truth, and the frontend re-reads it after every transaction.

**Why on-chain:** the funds sit in a PDA-owned vault, not with a company. The rules are the program. Neither party can move the money outside the state machine, and neither can force a payout the other did not agree to. When the deadline passes and the client is silent, the freelancer can claim — no support ticket required.

## 🛠 Stack

| | |
|---|---|
| Program | Rust, Anchor 0.32.1 |
| Chain | Solana |
| Token | USDC (SPL, 6 decimals) |
| Frontend | React, Vite, TypeScript |
| Wallets | Phantom, Solflare |
| Tests | LiteSVM (16 scenarios, in-process) |

## 🌐 Live deployment (devnet)

| | |
|---|---|
| Cluster | Devnet |
| Program ID | Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ |
| USDC mint | 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU (Circle devnet) |

**Devnet only. Not on mainnet.**

## 🎬 Try it (for judges and anyone else)

You do not need to install anything. The frontend is a web app that runs against the live devnet program.

**What you need**

- A browser (Chrome, Brave, Firefox, or Edge)
- The [Phantom](https://phantom.app) or [Solflare](https://solflare.com) wallet extension
- Both wallets set to **Devnet** (Settings -> Developer Settings -> Change Network -> Devnet)

**Get free test funds**

- Devnet SOL (for transaction fees): [faucet.solana.com](https://faucet.solana.com) — paste your wallet address, request 1 SOL.
- Devnet USDC (the actual escrow currency): [faucet.circle.com](https://faucet.circle.com) — select **Solana Devnet**, paste your wallet address, request 10 USDC.

**Walk through a full lifecycle**

1. Connect the wallet as the **client**. Create an escrow: pick a freelancer address (a second wallet, or your own — you can play both roles), an arbiter, a small amount of USDC (1 is plenty), and a deadline.
2. Approve the transaction. The escrow shows as **Funded** on the dashboard.
3. Switch to the **freelancer** wallet and click **Mark Delivered**. Status becomes **Delivered**.
4. Switch back to the **client** and click **Release**. Status becomes **Released**. The USDC is now in the freelancer's wallet.

Every step is visible on [explorer.solana.com](https://explorer.solana.com/?cluster=devnet) — paste the escrow address or any transaction signature to watch the state change on chain.

**Verifying the program exists**

Any Solana explorer will do, or:

```bash
solana program show Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ --url devnet
```

## 📁 Repo layout

```
programs/mohar/          Anchor program (single crate)
app/                     React + Vite frontend
  src/pages/             Landing, Dashboard, CreateEscrow, EscrowDetail
  src/components/        Wallet button, connect modal, shared UI
  src/lib/               Anchor client, IDL, config
mohar-litesvm/           Program test suite (LiteSVM, no validator required)
brand/                   Logo assets
```

## 🚀 Running locally

Prerequisites:

- **Rust stable** — [rustup.rs](https://rustup.rs)
- **Solana CLI 4.x** — [solana.com/docs/intro/installation](https://solana.com/docs/intro/installation)
- **Anchor CLI 0.32.1**

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.1
avm use 0.32.1
```

- **Node.js 20+** — [nodejs.org](https://nodejs.org)

Clone and build:

```bash
git clone https://github.com/UrbishCodes/mohar.git
cd mohar

# 1. Run the program test suite
cd mohar-litesvm
cargo test
cd ..

# 2. Install and run the frontend
cd app
npm install --ignore-scripts
npm run dev
```

The dev server prints a local URL (usually http://localhost:5173). Open it in your browser, connect a wallet, switch to devnet, and you are in.

> **Use npm install --ignore-scripts, not npm ci.** Two transitive dependencies (@stellar/stellar-sdk, @keystonehq/sdk) run yarn in their postinstall scripts, which is not installed by default. npm ci will fail. The --ignore-scripts flag skips those hooks; nothing the app uses depends on them.

To point the frontend at a different cluster or mint, edit app/src/lib/config.ts, or set it in the browser console:

```javascript
localStorage.setItem("mohar:cluster", "devnet");
localStorage.setItem("mohar:mint", "<mint-address>");
location.reload();
```

## ✅ Testing

**LiteSVM suite** — 16 tests, in-process, ~5 seconds. No validator required. Covers every instruction, PDA derivation, vault funding and closure, mint constraints, signer checks, unauthorized-action rejections, wrong-destination rejections, and double-spend protection.

```bash
cd mohar-litesvm && cargo test
```

The program has also been exercised end-to-end on devnet with real wallets and real Circle USDC across the full lifecycle, plus the dispute and refund paths.

## 🔐 Security

The program has had a **manual security review, not an audit.** Read that literally. The logic is small and the test surface is broad, but there has been no third-party audit and the code is not production-hardened.

Do not deploy to mainnet without a proper audit.

The deployed program's upgrade authority keypair is not in this repository and is not committed anywhere.

## 🚧 Not in v1

- Mainnet deployment.
- Milestone-based partial releases. (Roadmap.)
- Multi-token support. USDC only in v1.
- On-chain reputation, notifications, mobile app, fiat off-ramp.

## 📄 License

<!-- Fill in, or delete this section. -->