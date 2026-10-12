import type { View } from "../components/TopBar";

export default function Guide({ go }: { go: (v: View) => void }) {
  return (
    <div className="page">
      <div className="card legal">
        <button className="btn btn-ghost" onClick={() => go({ name: "landing" })}>
          ← Back
        </button>
        <h1>How to use Mohar</h1>
        <p className="legal-updated">
          Mohar runs on the Solana <strong>devnet</strong> test network. Tokens
          here have no real value — everything below is free.
        </p>

        <h2>1. Install a Solana wallet</h2>
        <p>
          You need a Solana wallet browser extension.{" "}
          <a href="https://phantom.app" target="_blank" rel="noreferrer">
            Phantom
          </a>{" "}
          is the simplest choice;{" "}
          <a href="https://solflare.com" target="_blank" rel="noreferrer">
            Solflare
          </a>{" "}
          also works. Install the extension, then create a new wallet (or
          import an existing one) and save your recovery phrase somewhere
          safe.
        </p>

        <h2>2. Switch the wallet to devnet</h2>
        <p>
          Wallets default to mainnet. In <strong>Phantom</strong>, open
          Settings → Developer Settings, turn on <em>Testnet Mode</em>, then
          change the network to <strong>Devnet</strong>. In{" "}
          <strong>Solflare</strong>, open Settings → Network and select{" "}
          <strong>Devnet</strong>. Your address stays the same; only the
          network changes.
        </p>

        <h2>3. Get free test SOL</h2>
        <p>
          Devnet SOL pays for transaction fees and is free. Go to{" "}
          <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">
            faucet.solana.com
          </a>
          , connect your wallet (or paste your address), and request an
          airdrop. It usually arrives within seconds. If the faucet is rate
          limited, wait a few minutes and try again.
        </p>

        <h2>4. Get free test USDC</h2>
        <p>
          Escrows on Mohar are denominated in USDC. Get devnet USDC from{" "}
          <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">
            faucet.circle.com
          </a>
          : choose <strong>Solana Devnet</strong> as the network, paste your
          wallet address, and claim. The tokens appear in your wallet shortly
          after.
        </p>

        <h2>5. Connect and create a profile (optional)</h2>
        <p>
          Back on Mohar, click <strong>Connect wallet</strong> and approve the
          connection. You can also create a free profile (username + email)
          from the Profile page — it is optional and only used for display.
        </p>

        <h2>6. Fair by design: neither side has the upper hand</h2>
        <p>
          Every power in Mohar has a counterweight. Neither the client nor
          the freelancer can take the money and run:
        </p>
        <ul>
          <li>
            <strong>The client can't ghost with the money.</strong> Once the
            freelancer accepts, the client cannot cancel unilaterally. If
            the client disappears, the freelancer claims the funds after the
            deadline.
          </li>
          <li>
            <strong>The freelancer can't steal the money.</strong> They can
            only claim after the deadline on a job they actually accepted —
            and only if the client never disputed. The client can{" "}
            <em>always</em> raise a dispute before the deadline, which
            freezes everything until the arbiter decides.
          </li>
          <li>
            <strong>The arbiter can't steal either.</strong> The arbiter can
            only send the full amount to one of the two parties, and only
            when a dispute has been raised. They cannot take a cut or send
            it elsewhere.
          </li>
          <li>
            <strong>No one moves funds alone.</strong> Every payout needs
            the normal flow (release), a passed deadline (claim/reclaim), or
            an arbiter ruling (dispute). There is no backdoor.
          </li>
        </ul>

        <h2>7. Run the full escrow flow</h2>
        <p>
          To play both sides you need <strong>two wallets</strong>: use two
          browser profiles, two browsers, or Phantom + Solflare side by side.
          One acts as the <strong>client</strong>, the other as the{" "}
          <strong>freelancer</strong>. Use your second wallet as the arbiter
          so you can also test disputes.
        </p>
        <div className="notice notice-info">
          <strong>Tip:</strong> you don't need two browsers — one extension
          is enough. Both Phantom and Solflare let you create multiple
          wallets (accounts) inside the same extension; use one as the
          client, one as the freelancer, and one as the arbiter, and switch
          between them. Just remember <em>each</em> wallet needs its own
          devnet SOL for transaction fees (airdrop to every address), and
          the client wallet needs the USDC to fund the escrow.
        </div>
        <ol>
          <li>
            <strong>Create an escrow (client).</strong> From the dashboard,
            click <em>+ New escrow</em>. Enter the freelancer's wallet
            address, the arbiter's wallet address, an amount, and a deadline.
            Approve the transaction — the full amount moves into a vault
            controlled by the Mohar program.
          </li>
          <li>
            <strong>Accept the job (freelancer).</strong> Open the escrow with
            the freelancer wallet and click <em>Accept job</em>. The client
            can no longer cancel after this point.
          </li>
          <li>
            <strong>Mark delivered (freelancer).</strong> Click{" "}
            <em>Mark delivered</em> when the work is done. This is a signal
            only — Mohar does not verify any work.
          </li>
          <li>
            <strong>Release payment (client).</strong> Switch back to the
            client wallet and click <em>Release payment</em>. The USDC moves
            to the freelancer. Done — the happy path.
          </li>
        </ol>

        <h2>8. Try the other paths</h2>
        <ul>
          <li>
            <strong>Refund:</strong> while an escrow is still unaccepted, the
            client can refund and cancel it.
          </li>
          <li>
            <strong>Dispute:</strong> while an escrow is Funded, In Progress,
            or Delivered, either side can raise a dispute. Only the arbiter
            can resolve it — their decision is final. <strong>As a client,
            raise the dispute <em>before</em> the deadline if the freelancer
            isn't doing the job.</strong> A dispute blocks any deadline
            claim — but once the deadline passes, the freelancer can claim
            at any moment, and then it's too late. Be aware.
          </li>
          <li>
            <strong>Deadline claim:</strong> if the deadline passes on an
            accepted escrow (In Progress or Delivered) with no release and no
            dispute, the freelancer can claim the funds.
          </li>
          <li>
            <strong>Reclaim:</strong> if the freelancer never accepted and the
            deadline passes, the client can reclaim the funds.
          </li>
        </ul>

        <h2>Notes</h2>
        <ul>
          <li>Devnet can be slow or briefly reset — retry if a transaction stalls.</li>
          <li>Every action asks for confirmation first; cancelling never moves funds.</li>
          <li>Nothing here uses real money. Test freely.</li>
        </ul>
      </div>
    </div>
  );
}
