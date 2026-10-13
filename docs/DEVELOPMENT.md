# Development guide

How to set up the toolchain, run the app, run the tests and change the code. If you only want to use Mohar, open the [live app](https://mohar-beta.vercel.app) and read the [user guide](USER_GUIDE.md).

**On this page**

1. [Prerequisites](#prerequisites)
2. [Get the code](#get-the-code)
3. [Run the frontend](#run-the-frontend)
4. [Environment variables](#environment-variables)
5. [Run the tests](#run-the-tests)
6. [Build the program](#build-the-program)
7. [Using a different USDC mint](#using-a-different-usdc-mint)
8. [Repository map](#repository-map)
9. [Making a change](#making-a-change)
10. [Deploying](#deploying)

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Rust | stable **1.97.1 or newer** ([rustup.rs](https://rustup.rs)) | Builds the program and the LiteSVM tests. If `cargo test` complains about your rustc version, run `rustup update`. |
| Solana CLI | 4.x ([install guide](https://solana.com/docs/intro/installation)) | Program tooling, wallets, `solana program show` |
| Anchor CLI | **0.32.1** | Builds the program and generates the IDL |
| Node.js | 20 or newer ([nodejs.org](https://nodejs.org)) | Frontend |

Install Anchor 0.32.1 with `avm`:

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.1
avm use 0.32.1
```

Check everything:

```bash
rustc --version
solana --version
anchor --version     # anchor-cli 0.32.1
node --version       # v20 or newer
```

## Get the code

```bash
git clone https://github.com/UrbishCodes/mohar.git
cd mohar
```

## Run the frontend

```bash
cd app
npm install --ignore-scripts
npm run dev
```

The dev server prints a local URL, usually `http://localhost:5173`. Open it, connect a wallet, switch the wallet to **devnet**, and you are talking to the live devnet program.

> [!WARNING]
> Use `npm install --ignore-scripts`, **not** `npm ci`. Two transitive dependencies (`@stellar/stellar-sdk` and `@keystonehq/sdk`) run `yarn` in their postinstall scripts, and `yarn` is not installed by default, so `npm ci` fails. The `--ignore-scripts` flag skips those hooks. Nothing the app uses depends on them.

You will need devnet SOL and devnet USDC in your wallet. See [User guide, section 1.3](USER_GUIDE.md#13-get-test-funds).

## Environment variables

Everything is optional. Copy the example file and fill in only what you need:

```bash
cd app
cp .env.example .env
```

| Variable | Needed for | If missing |
|---|---|---|
| `VITE_SUPABASE_URL` | Profiles and sign-in | The Profile page shows "not configured". Everything else works. |
| `VITE_SUPABASE_ANON_KEY` | Profiles and sign-in | Same as above |
| `VITE_HELIUS_API_KEY` | A faster, less rate-limited devnet RPC | The app uses the public devnet endpoint |

Notes:

- Never commit `.env`.
- The Supabase URL and anon (publishable) key are public by design and end up in the frontend bundle. Never put a Supabase **service-role** key in any `VITE_` variable.
- The database schema for profiles lives in `supabase/` as migrations. Apply them to your own Supabase project if you want profiles locally.

## Run the tests

### Program tests (LiteSVM)

25 tests, in-process, no validator required.

```bash
# Update Rust first. If the build fails, run this before anything else.
rustup update

cd mohar-litesvm
cargo test
```

They cover every instruction (including the accept handshake, deadline claim and reclaim, and the dispute paths), PDA derivation, vault funding and closure, mint constraints, signer checks, unauthorized-action rejections, wrong-destination rejections and double-spend protection.

### Devnet integration tests

15 tests in `tests/mohar.ts` that run against the **live devnet program**. They need network access and a funded devnet wallet (SOL for fees, and devnet USDC where a test locks funds). Because they hit the real deployment, run them when you want to verify the deployed program, not on every change.

### Frontend checks

```bash
cd app
npm run build    # type-check and production build
npm run lint
```

## Build the program

```bash
# If the build fails, update Rust first, then rebuild.
rustup update
anchor build
```

This builds `programs/mohar` and regenerates the IDL. If the program's interface changed, copy the new IDL into `app/src/lib` so the frontend matches, then rebuild the app.

## Using a different USDC mint

The app uses Circle's devnet USDC by default (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). To point it at another mint, run this in the browser console and reload:

```javascript
localStorage.setItem("mohar:mint", "<mint-address>");
location.reload();
```

To go back to the default, remove the key:

```javascript
localStorage.removeItem("mohar:mint");
location.reload();
```

## Repository map

```text
programs/mohar/          Anchor program (single crate)
app/                     React + Vite frontend
  src/pages/             Landing, Dashboard, CreateEscrow, EscrowDetail,
                         Profile, Guide, Privacy, Terms
  src/components/        Wallet button, connect modal, confirm dialogs, shared UI
  src/lib/               Anchor client, IDL, config, router, Supabase client
mohar-litesvm/           Program test suite (LiteSVM, no validator required)
supabase/                Database migrations (profiles)
brand/                   Logo assets and the README banner
docs/                    User guide, architecture, development, FAQ
```

## Making a change

**Changing the program.** Any change to an instruction, an account field or a status touches money rules. Add or update a LiteSVM test first, run `cargo test`, then update the [architecture document](ARCHITECTURE.md) and the [state diagram in the README](../README.md#the-deal-path) in the same change. Rebuild the IDL and update the frontend.

**Changing the frontend.** Buttons must keep following the state machine: offer an action only when it is valid for the viewer's role and the escrow's status. Never change what a transaction does from the frontend, and leave wallet and transaction code alone unless the change is about them. After a transaction, the app re-reads the escrow, so keep it that way.

**Before you open a pull request**

- [ ] `cargo test` passes in `mohar-litesvm`
- [ ] `npm run build` and `npm run lint` pass in `app`
- [ ] Docs updated if behaviour changed
- [ ] No secrets, keypairs or `.env` files in the diff

## Deploying

**Frontend.** The live app is hosted on Vercel and talks to the devnet program. Set the same optional environment variables in the host's settings.

**Program.** The program is deployed to devnet and is **upgradeable**. The upgrade authority keypair is not in this repository and must never be committed. The program has had a manual review, not an audit, and **must not be deployed to mainnet without a proper audit**.
