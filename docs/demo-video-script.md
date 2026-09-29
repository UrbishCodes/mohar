# Mohar — Technical Demo Video Script (DRAFT)

**Target:** ≤3 minutes (the HOW — stack, Solana integration, decisions)
**Format:** Screenshare walkthrough with voiceover; code shown where marked

---

## 1. Architecture (0:00–0:40)

*[Show: program diagram / repo]*

"Mohar is an Anchor program on Solana with six instructions. Each escrow is
a PDA derived from the client's key plus a seed, so one client can run many
escrows. Funds sit in a vault — a token account owned by the escrow PDA, so
only the program can move them.

The state machine is strict: Funded → Delivered → Released, with Refunded,
Disputed, and Resolved as the alternate paths. Invalid transitions are
rejected on-chain, not just in the UI."

## 2. Happy path — live demo (0:40–1:40)

*[Show: the app, devnet, two wallets]*

"Here's the full flow on devnet. The client connects a wallet and creates an
escrow: freelancer address, 100 devnet USDC, a 7-day deadline. *[Show the
transaction]* Funds lock in the vault — the client's balance drops, the
escrow shows Funded.

Switching to the freelancer wallet: mark delivered. *[Show]* Status flips to
Delivered. Back to the client: approve and release. *[Show]* The vault pays
out, the freelancer's balance rises, and the vault closes to reclaim rent.
Three transactions, sub-cent fees, done in seconds."

## 3. The safety paths (1:40–2:25)

"Now the paths that make it escrow, not just payments.

One — the client cancels before delivery: full refund, one click.

Two — the client ghosts. The deadline passes, and the freelancer calls
claim-after-deadline. No permission needed. This is the 'no more ghosted
invoices' guarantee, enforced by the program.

Three — a genuine dispute. Either side raises it, funds freeze, and the
arbiter — named at escrow creation — rules release or refund. *[Show the
resolve transaction]*"

## 4. Decisions & tradeoffs (2:25–2:55)

"Three decisions worth naming. First, the vault is a PDA-owned token account
rather than a program-owned pool — every escrow is isolated, so one bug
can't drain others. Second, the arbiter is chosen per-escrow, not global —
clients pick someone both sides trust. Third, USDC, not SOL — freelancers
think in dollars, and price volatility shouldn't be part of getting paid.

Repo's in the description — the program, the tests, and the frontend.
Thanks for watching."
