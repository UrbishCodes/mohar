import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import type { View } from "../components/TopBar";
import {
  getProgram,
  findEscrowPda,
  findVaultPda,
  getOrCreateAta,
  tokenProgramId,
  SystemProgram,
} from "../lib/mohar";
import { getMintAddress } from "../lib/config";

export default function CreateEscrow({ go }: { go: (v: View) => void }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;

  const [freelancer, setFreelancer] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!publicKey) {
      setError("Connect your wallet first.");
      return;
    }
    let freelancerPk: PublicKey;
    let arbiterPk: PublicKey;
    try {
      freelancerPk = new PublicKey(freelancer.trim());
      arbiterPk = new PublicKey(arbiter.trim());
    } catch {
      setError("Freelancer and arbiter must be valid Solana addresses.");
      return;
    }
    if (freelancerPk.equals(publicKey)) {
      setError("You can't be your own freelancer — the client and freelancer must differ.");
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    if (!Number.isFinite(deadlineTs) || deadlineTs <= Date.now() / 1000) {
      setError("Deadline must be a date in the future.");
      return;
    }

    setBusy(true);
    try {
      const mint = new PublicKey(getMintAddress());
      const mintInfo = await getMint(connection, mint);
      const amountBase = BigInt(Math.round(amountNum * 10 ** mintInfo.decimals));

      const program = getProgram(connection, wallet);
      // Random 64-bit seed so every escrow gets a unique address.
      const seed = new BN(
        BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString()
      );
      const [escrowPda] = await findEscrowPda(publicKey, seed);
      const [vaultPda] = await findVaultPda(escrowPda);

      const clientAta = await getOrCreateAta(
        connection,
        publicKey,
        mint,
        publicKey,
        async (tx: Transaction) => {
          const sig = await sendTransaction(tx, connection);
          await connection.confirmTransaction(sig, "confirmed");
          return sig;
        }
      );

      const sig = await program.methods
        .createEscrow(seed, new BN(amountBase.toString()), new BN(deadlineTs))
        .accounts({
          escrow: escrowPda,
          client: publicKey,
          freelancer: freelancerPk,
          arbiter: arbiterPk,
          mint,
          vault: vaultPda,
          clientAta,
          tokenProgram: tokenProgramId,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(sig, "confirmed");
      go({ name: "detail", escrow: escrowPda.toBase58() });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.length > 300 ? msg.slice(0, 300) + "…" : msg
      );
    } finally {
      setBusy(false);
    }
  };

  if (!wallet.connected) {
    return (
      <div className="page">
        <div className="empty">
          <div className="big">🔒</div>
          <h2>Connect your wallet</h2>
          <p>Connect a Solana wallet to create an escrow.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="detail-head">
        <div>
          <h2 style={{ margin: "0 0 4px" }}>New escrow</h2>
          <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 14 }}>
            Lock USDC for a freelancer. Sealed until delivery or the deadline.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="form">
          <div className="field">
            <label>Freelancer's wallet address</label>
            <input
              placeholder="The person doing the work"
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label>Arbiter's wallet address</label>
            <input
              placeholder="Mutually trusted third party for disputes"
              value={arbiter}
              onChange={(e) => setArbiter(e.target.value)}
              spellCheck={false}
            />
            <div className="hint">
              Pick someone both sides trust. They can only act if a dispute is raised.
            </div>
          </div>
          <div className="field">
            <label>Amount (USDC)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="500.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <div className="hint">
              If the deadline passes without release, the freelancer can claim the funds.
            </div>
          </div>

          {error && <div className="notice notice-error">{error}</div>}

          <div className="notice notice-info">
            The full amount leaves your wallet now and sits in a program-owned
            vault until release, refund, claim, or dispute resolution.
          </div>

          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" /> Sealing the deal…
              </>
            ) : (
              "Seal it — lock USDC"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
