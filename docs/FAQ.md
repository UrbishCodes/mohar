# FAQ and troubleshooting

Quick answers and fixes. For the full walkthrough, see the [user guide](USER_GUIDE.md).

**On this page**

- [Quick answers](#quick-answers)
- [Troubleshooting](#troubleshooting)
- [Error messages](#error-messages)
- [Developer problems](#developer-problems)

---

## Quick answers

### Is this real money?

No. Mohar runs on **Solana devnet** with **test USDC** from Circle's faucet. Do not send real funds to the program.

### Does Mohar take a fee?

No. There is no platform cut. You only pay Solana's network fee, a very small amount of SOL (devnet SOL is free).

### Who holds the money?

A vault owned by the program. Not a person, not a company. See [Architecture](ARCHITECTURE.md#1-the-pieces).

### What if the client disappears?

If the deadline passes and nobody raised a dispute, the freelancer can **claim** the full amount. No support ticket.

### What if the freelancer never accepts?

The client can **refund** at any time before the freelancer accepts. If the deadline passes without acceptance, the client can **reclaim**.

### What if we disagree about the work?

Either side can **raise a dispute** while the job is In Progress or Delivered. Everything freezes until the arbiter decides who gets the money. The arbiter's decision is final and covers the full amount.

### Can the client cancel after the freelancer accepts?

Not on their own. After acceptance the client's options are to release payment, raise a dispute, or wait. That is what makes the deal safe for the freelancer.

### Can I change the freelancer, arbiter, amount or deadline after creating the escrow?

No. They are written to the chain when the escrow is created. If something is wrong and the freelancer has not accepted, refund and create a new escrow.

### Can I do a partial payment or milestones?

Not in v1. Every payout is the full amount. Milestone releases are on the roadmap.

### Can I use something other than USDC?

Not in v1.

### Who should be the arbiter?

Someone neutral that both sides trust and that you agreed on before the escrow was created. The arbiter has the final say, so choose carefully.

### Can I be more than one role in the same escrow?

For practice on devnet, yes: use three accounts in one wallet extension. For a real deal, the three roles should be three different people.

### Is it safe?

The program has had a manual security review, **not an audit**. It is a devnet project. Do not use it with real money. See the [security section of the README](../README.md#security).

### Is the program upgradeable?

Yes. The holder of the upgrade authority can change the program. That key is not in the repository. This should be addressed (for example with a multisig or by burning the authority) before any mainnet use.

---

## Troubleshooting

### I connected my wallet but see no escrows

1. Check the wallet is on **Devnet**. Phantom: Settings → Developer Settings → Testnet Mode → Devnet.
2. Check you are connected with the right wallet account. The escrow only appears for the client, freelancer or arbiter wallet it names.
3. Refresh the page.
4. If you have the escrow link, open it directly (`/escrow/<address>`).

### The wallet does not pop up

- Make sure the wallet extension is installed and unlocked.
- Click **Connect wallet** and pick the wallet you use.
- Check the browser is not blocking the extension popup.
- Try a refresh, or disable other wallet extensions that may fight over the page.

### Transaction fails with "insufficient funds" or "insufficient lamports"

You are out of devnet SOL. Request an airdrop at [faucet.solana.com](https://faucet.solana.com). If the faucet limits you, wait a bit and try again, or use a smaller request.

### I cannot create an escrow: not enough USDC

Get devnet USDC at [faucet.circle.com](https://faucet.circle.com). Choose **Solana Devnet**, paste your wallet address and claim. The faucet is rate limited, so claim once and reuse the funds.

Make sure you got **Circle's devnet USDC** (mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). Tokens from other faucets use a different mint and will not work.

### I rejected the transaction in my wallet

Nothing was sent and nothing moved. Your USDC is exactly where it was. Click the action again when you are ready.

### A button I expected is missing

Buttons only appear when the action is valid for your role **and** the current status. Check [the status table](USER_GUIDE.md#6-statuses-at-a-glance). Common cases:

| You expected | Why it may be missing |
|---|---|
| Refund (client) | The freelancer already accepted |
| Release (client) | The freelancer has not marked it delivered yet |
| Claim (freelancer) | The deadline has not passed, or a dispute is open |
| Reclaim (client) | The deadline has not passed, or the job was accepted |
| Resolve (arbiter) | Nobody has raised a dispute |
| Any button | You are connected with a wallet that is not named on this escrow |

### The status looks wrong or out of date

The app reads the chain, so a stale screen usually means a slow refresh. Reload the page. If it still looks wrong, paste the escrow address into [Solana Explorer](https://explorer.solana.com/?cluster=devnet) (cluster: Devnet) to see the true state.

### The transaction is taking a long time

Devnet is sometimes slow or congested. Wait a minute, then reload and check the escrow status before you try again, because the first transaction may have gone through. If you set a Helius key, it usually helps.

### I sent the transaction twice

The second one fails with `InvalidStatus`, because the escrow has already moved on. Your funds are safe. See [Error messages](#error-messages).

### The escrow link says "not found"

- Check the wallet network is Devnet and the app is the devnet app.
- Check the address was copied fully. Escrow addresses are 32 to 44 characters.

### I do not recognise an address on the page

Addresses are shortened (for example `7Hq3…k2Fp`). Open the escrow on the explorer to see the full address, and compare it with the wallet you expect.

### Profiles say "not configured"

The deployment you are using does not have profiles set up. Everything else works without them. To set them up locally, see [Development](DEVELOPMENT.md#environment-variables).

---

## Error messages

These come from the program. Your funds are never moved when a transaction fails.

| Error | What it means | What to do |
|---|---|---|
| `InvalidAmount` | The amount was zero or less | Enter an amount above zero |
| `InvalidDeadline` | The deadline is not in the future | Choose a later deadline |
| `InvalidStatus` | The escrow is not in a state that allows this action. Often it already moved on, for example from a double click. | Reload and check the status |
| `DeadlineNotReached` | You tried to claim or reclaim before the deadline | Wait until the deadline has passed |
| `Unauthorized` | Your wallet is not allowed to do this | Connect the wallet that is named for this role |
| `InvalidDestination` | A token account is not owned by the intended recipient | Reload and retry. If it keeps happening, contact the maintainers with the transaction signature. |

---

## Developer problems

### `npm ci` fails

Use `npm install --ignore-scripts`. Two transitive dependencies run `yarn` in their postinstall hooks and `yarn` is not installed by default. See [Development](DEVELOPMENT.md#run-the-frontend).

### `cargo test` says my rustc is too old

The LiteSVM test dependencies need Rust 1.97.1 or newer. Run `rustup update` and try again.

### `anchor` reports the wrong version

Run `avm use 0.32.1`, then `anchor --version` to confirm.

### The app shows no data after I changed the program

Rebuild with `anchor build`, copy the new IDL into `app/src/lib`, and restart the dev server. The frontend must use the IDL that matches the deployed program.

### I need to point the app at a different mint

See [Development](DEVELOPMENT.md#using-a-different-usdc-mint).

---

Still stuck? Open an issue on [GitHub](https://github.com/UrbishCodes/mohar/issues) with the escrow address, the transaction signature and what you expected to happen. Never share a seed phrase or private key with anyone.
