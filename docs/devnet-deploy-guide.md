# Mohar — Devnet Deployment Guide

> The sandbox where Mohar was built cannot reach Solana devnet
> (the network path to devnet RPC is blocked), so deployment happens
> on your own machine. Everything below was prepared so you can
> deploy in ~15 minutes.

## 1. Prerequisites

- Rust stable (`rustup update`)
- Solana CLI 4.x — https://solana.com/docs/intro/installation
- Anchor CLI 0.32.1 — `cargo install --git https://github.com/coral-xyz/anchor avm --locked --force`
  then `avm install 0.32.1 && avm use 0.32.1`
- Node 20+ and npm

## 2. Get devnet SOL

```bash
solana config set --url devnet
solana-keygen new -o ~/.config/solana/id.json   # skip if you already have one
solana airdrop 2
```

## 3. Deploy the program

The program ID is already baked in:

```
Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ
```

From the repo root:

```bash
anchor build
anchor deploy --provider.cluster devnet
```

Verify:

```bash
solana program show Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ --url devnet
```

> If you ever deploy with a fresh keypair instead, update the program ID
> in `Anchor.toml`, `programs/mohar/src/lib.rs` (`declare_id!`),
> `app/src/lib/config.ts`, and rebuild the IDL + frontend.

## 4. Get devnet USDC

The app defaults to Circle's devnet USDC mint:

```
4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

Faucet: https://faucet.circle.com (select Devnet) — or ask in the
Superteam Nepal Telegram for a devnet USDC drip.

To use a different mint, change `DEFAULT_USDC_MINT` in
`app/src/lib/config.ts` (or set it in the browser via
localStorage key `mohar:mint`) and rebuild.

## 5. Run the test suite (devnet)

```bash
npm install
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
```

This runs the 12-scenario suite against devnet: create/fund, delivery,
release, refund, deadline claim, disputes, and all rejection cases.

## 6. Run the frontend

```bash
cd app
npm install
npm run dev
```

Open the printed URL. Use the **Devnet/Localnet** toggle in the top bar
to switch clusters. Connect Phantom or Solflare.

Walk through the full flow with two wallets (or one wallet playing both
roles on separate escrows):

1. **Create** — lock USDC for a freelancer with a deadline and arbiter.
2. **Dashboard** — the escrow appears with its status timeline.
3. **Mark delivered** (freelancer) → **Release** (client).
4. Try the sad paths: refund before delivery, claim after the deadline
   passes, raise + resolve a dispute as the arbiter.

## 7. What was already verified

The in-process LiteSVM suite (`~/workspace/mohar-litesvm`, 16 tests,
all green) verified every state transition, PDA derivation, vault
funding/closure, mint constraints, signer checks, unauthorized-action
rejections, wrong-destination rejections, and double-spend protection.
It caught and fixed one real bug: the `client` account was missing `mut`
in `ClaimAfterDeadline` and `ResolveDispute`, which would have broken
every deadline claim and dispute resolution on-chain.

## 8. Before mainnet

- Get an audit (at least a second pair of expert eyes on
  `programs/mohar/src/lib.rs`).
- Add an IDL version gate if you ever upgrade the program.
- Consider a small protocol fee and a fee-collector account.
- Point the app at mainnet USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
  and the mainnet program deployment.
