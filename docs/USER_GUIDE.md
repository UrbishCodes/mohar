# Mohar user guide

This guide shows you how to use Mohar, step by step, whether you are the client, the freelancer or the arbiter. It matches the live app at [mohar-beta.vercel.app](https://mohar-beta.vercel.app). The same walkthrough is available inside the app, in the footer under **How to use Mohar**. Button names below may differ slightly from the app.

> [!IMPORTANT]
> Mohar runs on **Solana devnet** with **test USDC**. Nothing here is real money. Do not send real funds to the program.

**On this page**

1. [Before you start](#1-before-you-start)
2. [The ideas you need](#2-the-ideas-you-need)
3. [As the client](#3-as-the-client)
4. [As the freelancer](#4-as-the-freelancer)
5. [As the arbiter](#5-as-the-arbiter)
6. [Statuses at a glance](#6-statuses-at-a-glance)
7. [The deadline, explained](#7-the-deadline-explained)
8. [Checking everything on the explorer](#8-checking-everything-on-the-explorer)
9. [Sharing an escrow](#9-sharing-an-escrow)
10. [Profiles (optional)](#10-profiles-optional)
11. [Practice run on your own](#11-practice-run-on-your-own)

If something does not work, go to the [FAQ and troubleshooting](FAQ.md).

---

## 1. Before you start

You need three things: a wallet, the right network, and test funds.

### 1.1 Install a wallet

Install the [Phantom](https://phantom.app) or [Solflare](https://solflare.com) browser extension. Use Chrome, Brave, Firefox or Edge.

### 1.2 Switch the wallet to Devnet

| Wallet | Where to switch |
|---|---|
| Phantom | Settings → Developer Settings → Testnet Mode, then choose **Devnet** |
| Solflare | Open the network selector in Settings and choose **Devnet** |

If the wallet is on the wrong network, Mohar will not find your escrows. This is the most common first-time problem.

### 1.3 Get test funds

You need two kinds of test funds:

| Fund | What it is for | Where to get it |
|---|---|---|
| **Devnet SOL** | Pays the small network fee on every transaction | [faucet.solana.com](https://faucet.solana.com): paste your wallet address and request an airdrop |
| **Devnet USDC** | The money that goes into the escrow | [faucet.circle.com](https://faucet.circle.com): choose **Solana Devnet**, paste your wallet address, claim |

Only the **client** needs devnet USDC. Everyone who sends a transaction needs a little devnet SOL for fees.

### 1.4 Connect

Open [mohar-beta.vercel.app](https://mohar-beta.vercel.app), click **Connect wallet**, choose your wallet and approve the connection.

---

## 2. The ideas you need

**Escrow.** A locked deal. The client's USDC sits in a vault that belongs to the program, not to any person or company. The program releases it only according to fixed rules.

**The three roles.** Each escrow names three wallet addresses when it is created:

| Role | In one line |
|---|---|
| **Client** | Pays. Creates the escrow and locks the USDC. |
| **Freelancer** | Gets paid. Accepts the job and delivers the work. |
| **Arbiter** | Referee. Only acts if there is a dispute. |

The freelancer and arbiter cannot be changed after the escrow is created, so double-check their addresses.

**The deadline.** A date and time chosen by the client. After it passes, the freelancer is protected from a silent client, and the client is protected from a freelancer who never accepted. See [section 7](#7-the-deadline-explained).

**Every action is a transaction.** When you click a button that moves a deal forward, your wallet pops up and asks you to approve. Nothing happens until you approve. Read the amount in the wallet before you do.

**The app always shows what is on chain.** After each transaction, the app reads the escrow again. If a status looks out of date, refresh the page.

---

## 3. As the client

### 3.1 Create an escrow

1. Connect your wallet and open **Create escrow**.
2. Fill in the form:

   | Field | What to enter |
   |---|---|
   | **Freelancer address** | The freelancer's Solana wallet address. Copy it from their wallet. Check every character. |
   | **Arbiter address** | The wallet of someone both of you trust to settle a disagreement. It must be a third wallet, and you should have agreed on it with the freelancer first. |
   | **Amount** | How much USDC to lock. The app uses USDC with 6 decimals, so `1.5` means 1.5 USDC. |
   | **Deadline** | The date and time after which the freelancer may claim (or, if the job was never accepted, you may reclaim). It must be in the future. Allow room for time zones and for slow days. |

3. Click create and approve the transaction in your wallet.
4. The escrow appears on your dashboard as **Funded**. Your USDC is now in the vault.

> [!NOTE]
> At this point the deal is **not live yet**. The freelancer still has to accept it. Until they do, you can still cancel.

### 3.2 Cancel before the freelancer accepts (refund)

If the status is still **Funded**, open the escrow and click **Refund**. The full amount returns to your wallet. After the freelancer accepts, this button is gone, because the freelancer is now relying on the deal.

### 3.3 Release payment after delivery

When the freelancer marks the work as delivered, the status becomes **Delivered**.

1. Check the work.
2. If you are satisfied, open the escrow and click **Release**, then approve in your wallet.
3. The full amount goes to the freelancer and the status becomes **Released**.

Release is final. Do not release until you have checked the work.

### 3.4 If the work is not right: raise a dispute

Before the deadline, click **Raise dispute** on a job that is **In Progress** or **Delivered**. The status becomes **Disputed** and everything freezes. Nobody can release, claim or refund until the arbiter decides. See [section 5](#5-as-the-arbiter).

> [!TIP]
> Raise a dispute **before** the deadline. If the deadline passes while a delivered job sits unreleased and undisputed, the freelancer can claim the funds.

### 3.5 If the freelancer never accepts

If the deadline passes and the freelancer never accepted, click **Reclaim** to take your USDC back.

---

## 4. As the freelancer

### 4.1 Find the escrow

Connect with the wallet address the client entered. The escrow shows on your dashboard. You can also open the link the client sends you (`/escrow/<address>`).

Before you start any work, check on the escrow page that:

- the status is **Funded** (the money is really locked),
- the amount and deadline are what you agreed,
- you recognise the arbiter.

### 4.2 Accept the job

Click **Accept job** and approve in your wallet. The status becomes **In Progress**. From now on the client cannot cancel on their own.

Do not start the work until the job is accepted and shows **In Progress**.

### 4.3 Mark it delivered

When the work is finished and handed over, click **Mark Delivered** and approve. The status becomes **Delivered**, and the client can now release payment.

Mohar does not store or check the work itself. Deliver the files to the client the way you normally would.

### 4.4 Get paid

The client releases the payment. The USDC goes straight to your wallet and the status becomes **Released**.

### 4.5 If the client goes silent: claim

If the deadline has passed and the client has not released, and nobody raised a dispute, click **Claim**. You receive the full amount without asking anyone.

### 4.6 If the client disputes

The status becomes **Disputed**. Wait for the arbiter's decision. You can talk to the client and arbiter outside the app, but only the arbiter can resolve it on chain.

---

## 5. As the arbiter

You do nothing unless someone raises a dispute. Then:

1. Open the escrow (the client or freelancer will share the link, or it appears on your dashboard).
2. Talk to both sides outside the app and look at the work.
3. Decide who gets the money, and click one of:

   | Choice | Result |
   |---|---|
   | **Pay the freelancer** | The full amount goes to the freelancer |
   | **Refund the client** | The full amount goes back to the client |

4. Approve in your wallet. The status becomes **Resolved**.

The decision is **final and covers the whole amount**. There is no split and no appeal. Only agree to be an arbiter for people you can be fair to.

---

## 6. Statuses at a glance

| Status | What it means | Who can act next |
|---|---|---|
| **Funded** | The client locked the USDC. The freelancer has not accepted yet. | Freelancer: accept. Client: refund. Client: reclaim after the deadline. |
| **In Progress** | The freelancer accepted. Work is under way. | Freelancer: mark delivered. Either side: raise a dispute. Freelancer: claim after the deadline. |
| **Delivered** | The freelancer says the work is done. | Client: release. Either side: raise a dispute. Freelancer: claim after the deadline. |
| **Released** | The freelancer was paid. Final. | Nobody. |
| **Refunded** | The client got the money back. Final. | Nobody. |
| **Disputed** | A dispute is open. Everything is frozen. | Arbiter: resolve. |
| **Resolved** | The arbiter decided. Final. | Nobody. |

---

## 7. The deadline, explained

The deadline is the one date that changes who is allowed to do what.

| When | What it means |
|---|---|
| **Before the deadline** | Normal flow. Either side can raise a dispute while the job is in progress or delivered. The client can refund only until the freelancer accepts. |
| **After the deadline, job never accepted** | The client can **reclaim** the funds. |
| **After the deadline, job accepted, nobody disputed** | The freelancer can **claim** the full amount, whether or not the work was marked delivered. |
| **A dispute is open** | The deadline does not matter. Only the arbiter can decide. |

A few practical tips:

- The deadline is a fixed moment in time, not "a day". Allow for time zones and give the freelancer realistic time.
- A short deadline protects the client from a freelancer who never accepts, but it also means the freelancer can claim sooner.
- Clients: if you are unhappy with the work, **dispute before the deadline**. After it, the freelancer can take the funds.

---

## 8. Checking everything on the explorer

Mohar never hides anything. You can verify any step yourself.

1. Open [explorer.solana.com](https://explorer.solana.com/?cluster=devnet). Make sure the cluster is set to **Devnet**.
2. Paste an **escrow address** to see the escrow account, or a **transaction signature** to see exactly what a click did.
3. The program itself is at [`Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ`](https://explorer.solana.com/address/Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ?cluster=devnet).

From a terminal:

```bash
solana program show Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ --url devnet
```

---

## 9. Sharing an escrow

Every escrow has its own link:

```text
https://mohar-beta.vercel.app/escrow/<escrow-address>
```

Send it to the freelancer or the arbiter so they can open the deal directly. Anyone with the link can **view** the escrow, because it is public on chain, but only the three named wallets can act on it.

---

## 10. Profiles (optional)

Profiles let you attach a name to your wallet so people recognise you. They are stored separately from the escrow (in Supabase), sign in by **magic link** sent to your email, and are completely optional. Escrows work without one. If profiles are not set up on a given deployment, the Profile page says "not configured".

---

## 11. Practice run on your own

You can try every role alone using one wallet extension.

1. In Phantom or Solflare, create three accounts: **Client**, **Freelancer**, **Arbiter**. Copy each address.
2. Get devnet SOL for all three, and devnet USDC for the Client ([section 1.3](#13-get-test-funds)).
3. **Happy path.** As Client, create an escrow naming the other two accounts. As Freelancer, accept, then mark delivered. As Client, release. Check the USDC arrived.
4. **Refund path.** Create another escrow. Before the Freelancer accepts, refund it as Client.
5. **Dispute path.** Create another escrow, accept it, then raise a dispute from either account. As Arbiter, resolve it in either direction.
6. **Deadline paths.** Create an escrow with a deadline a few minutes away. Wait for it to pass. Try claiming as the Freelancer (after accepting), or reclaiming as the Client (without accepting).

Each time, paste the transaction signature into the explorer and watch the state change.
