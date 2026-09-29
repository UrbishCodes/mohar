import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { View } from "../components/TopBar";
import {
  getProgram,
  findVaultPda,
  getOrCreateAta,
  tokenProgramId,
  statusName,
  type EscrowAccount,
} from "../lib/mohar";
import {
  StatusPill,
  Timeline,
  formatAmount,
  formatDeadline,
  shortAddr,
} from "../components/ui";

export default function EscrowDetail({
  escrowKey,
  go,
}: {
  escrowKey: string;
  go: (v: View) => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;

  const [escrow, setEscrow] = useState<EscrowAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: string; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const program = getProgram(connection, wallet);
      const acct = await program.account.escrow.fetch(new PublicKey(escrowKey));
      setEscrow({ publicKey: new PublicKey(escrowKey), ...(acct as object) } as EscrowAccount);
    } catch (err) {
      console.error(err);
      setNotice({ kind: "notice-error", text: "Could not load this escrow. Check the address and cluster." });
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, escrowKey]);

  useEffect(() => {
    load();
  }, [load]);

  const ensureAta = async (mint: PublicKey, owner: PublicKey): Promise<PublicKey> => {
    return getOrCreateAta(connection, publicKey!, mint, owner, async (tx: Transaction) => {
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    });
  };

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setNotice(null);
    try {
      const sig = await fn();
      await connection.confirmTransaction(sig, "confirmed");
      setNotice({ kind: "notice-ok", text: `Confirmed: ${shortAddr(sig)}` });
      await load();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({
        kind: "notice-error",
        text: msg.length > 300 ? msg.slice(0, 300) + "…" : msg,
      });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="empty">
          <span className="spinner" /> Loading escrow…
        </div>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="page">
        {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}
        <button className="btn" onClick={() => go({ name: "dashboard" })}>
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const status = statusName(escrow.status);
  const isClient = !!publicKey && escrow.client.equals(publicKey);
  const isFreelancer = !!publicKey && escrow.freelancer.equals(publicKey);
  const isArbiter = !!publicKey && escrow.arbiter.equals(publicKey);
  const pastDeadline = Date.now() / 1000 >= escrow.deadline.toNumber();
  const canClaim = isFreelancer && (status === "Funded" || status === "Delivered") && pastDeadline;
  const program = () => getProgram(connection, wallet);

  const actionBtn = (
    label: string,
    key: string,
    className: string,
    fn: () => Promise<string>
  ) => (
    <button
      key={key}
      className={`btn ${className}`}
      disabled={busy !== null || !wallet.connected}
      onClick={() => run(key, fn)}
    >
      {busy === key ? (
        <>
          <span className="spinner" /> Working…
        </>
      ) : (
        label
      )}
    </button>
  );

  const vaultOf = async () => (await findVaultPda(escrow.publicKey))[0];

  const actions: React.ReactNode[] = [];
  if (status === "Funded" && isFreelancer) {
    actions.push(
      actionBtn("Mark as delivered", "deliver", "btn-primary", () =>
        program()
          .methods.markDelivered()
          .accounts({ escrow: escrow.publicKey, freelancer: publicKey! })
          .rpc()
      )
    );
  }
  if (status === "Funded" && isClient) {
    actions.push(
      actionBtn("Refund", "refund", "btn-danger", async () => {
        const vault = await vaultOf();
        const clientAta = await ensureAta(escrow.mint, escrow.client);
        return program()
          .methods.refund()
          .accounts({
            escrow: escrow.publicKey,
            client: publicKey!,
            vault,
            clientAta,
            tokenProgram: tokenProgramId,
          })
          .rpc();
      })
    );
  }
  if (status === "Delivered" && isClient) {
    actions.push(
      actionBtn("Release payment", "release", "btn-success", async () => {
        const vault = await vaultOf();
        const freelancerAta = await ensureAta(escrow.mint, escrow.freelancer);
        return program()
          .methods.release()
          .accounts({
            escrow: escrow.publicKey,
            client: publicKey!,
            vault,
            freelancerAta,
            tokenProgram: tokenProgramId,
          })
          .rpc();
      })
    );
  }
  if (canClaim) {
    actions.push(
      actionBtn("Claim after deadline", "claim", "btn-primary", async () => {
        const vault = await vaultOf();
        const freelancerAta = await ensureAta(escrow.mint, escrow.freelancer);
        return program()
          .methods.claimAfterDeadline()
          .accounts({
            escrow: escrow.publicKey,
            freelancer: publicKey!,
            vault,
            client: escrow.client,
            freelancerAta,
            tokenProgram: tokenProgramId,
          })
          .rpc();
      })
    );
  }
  if (
    (status === "Funded" || status === "Delivered") &&
    (isClient || isFreelancer)
  ) {
    actions.push(
      actionBtn("Raise dispute", "dispute", "btn-danger", () =>
        program()
          .methods.raiseDispute()
          .accounts({ escrow: escrow.publicKey, authority: publicKey! })
          .rpc()
      )
    );
  }
  if (status === "Disputed" && isArbiter) {
    actions.push(
      actionBtn("Resolve: pay freelancer", "resolve-yes", "btn-success", async () =>
        resolve(true)
      ),
      actionBtn("Resolve: refund client", "resolve-no", "btn-danger", async () =>
        resolve(false)
      )
    );
  }

  async function resolve(payFreelancer: boolean): Promise<string> {
    const vault = await vaultOf();
    const freelancerAta = await ensureAta(escrow!.mint, escrow!.freelancer);
    const clientAta = await ensureAta(escrow!.mint, escrow!.client);
    return program()
      .methods.resolveDispute(payFreelancer)
      .accounts({
        escrow: escrow!.publicKey,
        arbiter: publicKey!,
        vault,
        client: escrow!.client,
        freelancerAta,
        clientAta,
        tokenProgram: tokenProgramId,
      })
      .rpc();
  }

  const roleLabel = isClient ? "Client" : isFreelancer ? "Freelancer" : isArbiter ? "Arbiter" : "Viewer";

  return (
    <div className="page">
      <button className="btn btn-ghost" onClick={() => go({ name: "dashboard" })}>
        ← Dashboard
      </button>

      <div className="detail-head">
        <div>
          <h2 style={{ margin: "0 0 6px" }}>
            {formatAmount(escrow.amount)} USDC
          </h2>
          <StatusPill status={escrow.status} />
          <span
            style={{
              marginLeft: 10,
              fontSize: 13,
              color: "var(--text-dim)",
              fontWeight: 600,
            }}
          >
            You are the {roleLabel}
          </span>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={busy !== null}>
          ↻ Refresh
        </button>
      </div>

      <div className="card">
        <Timeline status={escrow.status} />
        <dl className="kv">
          <dt>Escrow address</dt>
          <dd className="addr">{escrow.publicKey.toBase58()}</dd>
          <dt>Client</dt>
          <dd className="addr">{escrow.client.toBase58()}</dd>
          <dt>Freelancer</dt>
          <dd className="addr">{escrow.freelancer.toBase58()}</dd>
          <dt>Arbiter</dt>
          <dd className="addr">{escrow.arbiter.toBase58()}</dd>
          <dt>Token mint</dt>
          <dd className="addr">{escrow.mint.toBase58()}</dd>
          <dt>Deadline</dt>
          <dd>
            {formatDeadline(escrow.deadline)}
            {pastDeadline && (status === "Funded" || status === "Delivered") && (
              <span style={{ color: "var(--gold)", marginLeft: 8 }}>· passed</span>
            )}
          </dd>
          <dt>Seed</dt>
          <dd className="addr">{new BN(escrow.seed.toString()).toString()}</dd>
        </dl>

        {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

        {actions.length > 0 && <div className="actions">{actions}</div>}

        {!wallet.connected && (
          <div className="notice notice-warn">
            Connect your wallet to take action on this escrow.
          </div>
        )}
        {wallet.connected &&
          actions.length === 0 &&
          (status === "Released" || status === "Refunded" || status === "Resolved") && (
            <div className="notice notice-info">
              This escrow is settled. Nothing left to do.
            </div>
          )}
      </div>
    </div>
  );
}
