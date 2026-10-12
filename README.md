# 🪙 Mohar — मोहर

**Sealed. Settled. Paid.**

On-chain escrow for freelancers working with international clients. The client locks USDC, the freelancer accepts and delivers, funds move when the deal does. No custodian, no platform cut, no _"I'll pay you next week"_.

**Live on Solana devnet:** [Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ](https://explorer.solana.com/address/Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ?cluster=devnet)

**Live app:** [mohar-beta.vercel.app](https://mohar-beta.vercel.app)

---

## 😤 The problem

Cross-border freelance work runs on trust. The client sends a deposit, or they don't. The freelancer starts the work, or they don't. When something goes wrong — late payment, ghosted client, disputed scope — the freelancer has no leverage. Marketplaces take a cut and resolve disputes slowly. Direct-client work, where margins are best, has no protection at all.

Mohar replaces that trust gap with a program.

## 🔒 How it works

The client creates an escrow and locks USDC into a program-owned vault. The freelancer and an arbiter are named on the escrow, on chain, up front. The freelancer accepts the job — only then is the deal live. From there:

```
  Funded ──accept_job──▶ InProgress ──mark_delivered──▶ Delivered ──release──▶ Released
    │       (freelancer)       │            (freelancer)       │          (client)
    │                          │                               │
    │ refund                   │ raise_dispute                 │ raise_dispute
    │ (client,                 │ (either side)                 │ (either side)
    │  before accept)          ▼                               ▼
    │                      Disputed ◀──────────────────────────┘
    │                          │
    │                          │ resolve_dispute (arbiter)
    │                          ▼
    │                       Resolved
    │
    │ reclaim_after_deadline (client, deadline passed, never accepted)
    ▼
  Refunded

  claim_after_deadline (freelancer, deadline passed, no dispute):
      InProgress ──▶ Released         Delivered ──▶ Released
```

Every transition is a program instruction. Every state change is on-chain. There is no off-chain escrow database — the program is the source of truth, and the frontend re-reads it after every transaction.

**Why on-chain:** the funds sit in a PDA-owned vault, not with a company. The rules are the program. Neither party can move the money outside the state machine, and neither can force a payout the other did not agree to. Once the freelancer accepts, the client can't cancel unilaterally; when the deadline passes and the client is silent, the freelancer can claim — no support ticket required. And if the work isn't done, the client can dispute *before* the deadline to freeze everything until the arbiter decides.

## 🛠 Stack

| | |
|---|---|
| Program | Rust, Anchor 0.32.1 |
| Chain | Solana |
| Token | USDC (SPL, 6 decimals) |
| Frontend | React, Vite, TypeScript |
| Wallets | Phantom, Solflare |
| Profiles/auth | Supabase (magic-link, PKCE) |
| Tests | LiteSVM (25 scenarios, in-process) + 15 devnet integration tests |

## 🌐 Live deployment (devnet)

| | |
|---|---|
| Cluster | Devnet |
| Program ID | Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ |
| USDC mint | 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU (Circle devnet) |

**Devnet only. Not on mainnet.**

## 🎬 Try it (for judges and anyone else)

**Open [mohar-beta.vercel.app](https://mohar-beta.vercel.app) in your browser.** No install, no clone, no build. The frontend is already running and talks to the live devnet program. There's also a full **How to use Mohar** guide in the app footer.

**What you need**

- A browser (Chrome, Brave, Firefox, or Edge)
- The [Phantom](https://phantom.app) or [Solflare](https://solflare.com) wallet extension
- Wallet set to **Devnet** (Phantom: Settings → Developer Settings → Testnet Mode → Devnet)

**Get free test funds**

- Devnet SOL (for transaction fees): [faucet.solana.com](https://faucet.solana.com) — paste your wallet address, request an airdrop.
- Devnet USDC (the actual escrow currency): [faucet.circle.com](https://faucet.circle.com) — select **Solana Devnet**, paste your wallet address, claim.

**Walk through a full lifecycle**

1. Connect the wallet as the **client**. Create an escrow: the freelancer's address, an arbiter's address, a small amount of USDC, and a deadline. (Tip: create multiple wallets inside one extension and play client, freelancer, and arbiter yourself.)
2. Approve the transaction. The escrow shows as **Funded** on the dashboard.
3. Switch to the **freelancer** wallet and click **Accept job**. Status becomes **In Progress** — the client can no longer cancel.
4. Click **Mark Delivered**. Status becomes **Delivered**.
5. Switch back to the **client** and click **Release**. Status becomes **Released**. The USDC is now in the freelancer's wallet.

Every step is visible on [explorer.solana.com](https://explorer.solana.com/?cluster=devnet) — paste the escrow address or any transaction signature to watch the state change on chain. Each escrow also has a shareable link: `/escrow/<address>`.

**Verifying the program exists**

Any Solana explorer will do, or:

```bash
solana program show Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ --url devnet
```

## 📁 Repo layout

```
programs/mohar/          Anchor program (single crate)
app/                     React + Vite frontend
  src/pages/             Landing, Dashboard, CreateEscrow, EscrowDetail,
                         Profile, Guide, Privacy, Terms
  src/components/        Wallet button, connect modal, confirm dialogs, shared UI
  src/lib/               Anchor client, IDL, config, router, Supabase client
mohar-litesvm/           Program test suite (LiteSVM, no validator required)
supabase/                Database migrations (profiles)
brand/                   Logo assets
```

## 🚀 Running locally

Prerequisites:

- **Rust stable (1.97.1+)** — [rustup.rs](https://rustup.rs). The LiteSVM
  test dependencies require rustc 1.97.1 or newer — if `cargo test`
  complains about your rustc version, run `rustup update` and try again.
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

> Profiles are optional: copy `.env.example` to `.env` and add Supabase
> keys only if you want profiles/auth locally — without them, the Profile
> page shows "not configured" and everything else works. The Helius RPC key
> is also optional; without it the app falls back to the public devnet
> endpoint.

The dev server prints a local URL (usually http://localhost:5173). Open it in your browser, connect a wallet, switch to devnet, and you are in.

> **Use npm install --ignore-scripts, not npm ci.** Two transitive dependencies (@stellar/stellar-sdk, @keystonehq/sdk) run yarn in their postinstall scripts, which is not installed by default. npm ci will fail. The --ignore-scripts flag skips those hooks; nothing the app uses depends on them.

To point the frontend at a different USDC mint, set it in the browser console:

```javascript
localStorage.setItem("mohar:mint", "<mint-address>");
location.reload();
```

## ✅ Testing

**LiteSVM suite** — 25 tests, in-process, no validator required. Covers every instruction (including the accept handshake, deadline claim/reclaim, and dispute paths), PDA derivation, vault funding and closure, mint constraints, signer checks, unauthorized-action rejections, wrong-destination rejections, and double-spend protection.

```bash
cd mohar-litesvm && cargo test
```

**Integration tests** — 15 tests against the live devnet program (`tests/mohar.ts`).

The program has also been exercised end-to-end on devnet with real wallets and real Circle USDC across the full lifecycle, plus the dispute, refund, claim, and reclaim paths.

## 🔐 Security

The program has had a **manual security review, not an audit.** Read that literally. The logic is small and the test surface is broad, but there has been no third-party audit and the code is not production-hardened.

Do not deploy to mainnet without a proper audit.

The program is **upgradeable**: the holder of its upgrade authority can change the program's rules. The upgrade authority keypair is not in this repository and is not committed anywhere.

## 🚧 Not in v1

- Mainnet deployment.
- Milestone-based partial releases. (Roadmap.)
- Multi-token support. USDC only in v1.
- On-chain reputation, notifications, mobile app, fiat off-ramp.

## 📄 License

Apache-2.0 — see [LICENSE](LICENSE). The Mohar name and brand assets are not covered by the license grant.
