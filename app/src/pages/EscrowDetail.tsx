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
  withRetry,
  type EscrowAccount,
} from "../lib/mohar";
import { StatusPill, Timeline, ExplorerAddr } from "../components/ui";
import { useConfirm, type ConfirmOptions } from "../components/ConfirmDialog";
import { formatAmount, formatDeadline, shortAddr } from "../lib/format";

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
  const [notice, setNotice] = useState<{ kind: string; text: string; sig?: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nowSec] = useState(() => Date.now() / 1000);
  const confirm = useConfirm();

  const fetchEscrow = useCallback(async (): Promise<EscrowAccount> => {
    const program = getProgram(connection, wallet);
    const acct = await withRetry(() => program.account.escrow.fetch(new PublicKey(escrowKey)));
    return {
      publicKey: new PublicKey(escrowKey),
      ...(acct as object),
    } as EscrowAccount;
  }, [connection, wallet, escrowKey]);

  useEffect(() => {
    let ignore = false;
    fetchEscrow()
      .then((data) => {
        if (!ignore) setEscrow(data);
      })
      .catch((err) => {
        console.error(err);
        if (!ignore)
          setNotice({
            kind: "notice-error",
            text: "Could not load this escrow. Check the address and cluster.",
          });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [fetchEscrow, refreshKey]);

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
      setNotice({ kind: "notice-ok", text: `Confirmed: ${shortAddr(sig)}`, sig });
      setLoading(true);
      setRefreshKey((k) => k + 1);
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
        {notice && (
          <div className={`notice ${notice.kind}`}>
            {notice.text}
            {notice.sig && (
              <>
                {" "}
                <a
                  href={`https://explorer.solana.com/tx/${notice.sig}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  View on explorer ↗
                </a>
              </>
            )}
          </div>
        )}
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
  const pastDeadline = nowSec >= escrow.deadline.toNumber();
  const canClaim = isFreelancer && (status === "InProgress" || status === "Delivered") && pastDeadline;
  const canReclaim = isClient && status === "Funded" && pastDeadline;
  const program = () => getProgram(connection, wallet);

  const actionBtn = (
    label: string,
    key: string,
    className: string,
    fn: () => Promise<string>,
    confirmOpts?: ConfirmOptions
  ) => (
    <button
      key={key}
      className={`btn ${className}`}
      disabled={busy !== null || !wallet.connected}
      onClick={async () => {
        if (confirmOpts) {
          const ok = await confirm(confirmOpts);
          if (!ok) return;
        }
        run(key, fn);
      }}
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
  const amountStr = `${formatAmount(escrow.amount)} USDC`;
  const freelancerShort = shortAddr(escrow.freelancer.toBase58());

  const actions: React.ReactNode[] = [];
  if (status === "Funded" && isFreelancer) {
    actions.push(
      actionBtn("Accept job", "accept", "btn-primary", () =>
        program()
          .methods.acceptJob()
          .accounts({ escrow: escrow.publicKey, freelancer: publicKey! })
          .rpc(),
        {
          title: "Accept this job?",
          message: (
            <>
              Accept this job for <strong>{amountStr}</strong>? Once accepted,
              the client can no longer cancel — funds move only via release,
              deadline claim, or arbiter decision.
            </>
          ),
          confirmLabel: "Accept job",
        }
      )
    );
  }
  if (status === "InProgress" && isFreelancer) {
    actions.push(
      actionBtn("Mark as delivered", "deliver", "btn-primary", () =>
        program()
          .methods.markDelivered()
          .accounts({ escrow: escrow.publicKey, freelancer: publicKey! })
          .rpc(),
        {
          title: "Mark as delivered?",
          message: (
            <>
              Mark this job as delivered? The client can then release{" "}
              <strong>{amountStr}</strong> to you.
            </>
          ),
          confirmLabel: "Mark delivered",
        }
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
      },
        {
          title: "Refund escrow?",
          message: (
            <>
              Refund <strong>{amountStr}</strong> to yourself and cancel this
              escrow? This cannot be undone.
            </>
          ),
          confirmLabel: "Refund",
          danger: true,
        }
      )
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
      },
        {
          title: "Release payment?",
          message: (
            <>
              Release <strong>{amountStr}</strong> to the freelancer (
              <code>{freelancerShort}</code>)? This cannot be undone.
            </>
          ),
          confirmLabel: "Release payment",
          danger: true,
        }
      )
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
      },
        {
          title: "Claim after deadline?",
          message: (
            <>
              Claim <strong>{amountStr}</strong> now that the deadline has
              passed? This cannot be undone.
            </>
          ),
          confirmLabel: "Claim funds",
          danger: true,
        }
      )
    );
  }
  if (canReclaim) {
    actions.push(
      actionBtn("Reclaim after deadline", "reclaim", "btn-danger", async () => {
        const vault = await vaultOf();
        const clientAta = await ensureAta(escrow.mint, escrow.client);
        return program()
          .methods.reclaimAfterDeadline()
          .accounts({
            escrow: escrow.publicKey,
            client: publicKey!,
            vault,
            clientAta,
            tokenProgram: tokenProgramId,
          })
          .rpc();
      },
        {
          title: "Reclaim escrow?",
          message: (
            <>
              Reclaim <strong>{amountStr}</strong>? The freelancer never
              accepted this job. This cannot be undone.
            </>
          ),
          confirmLabel: "Reclaim",
          danger: true,
        }
      )
    );
  }
  if (
    (status === "Funded" || status === "InProgress" || status === "Delivered") &&
    (isClient || isFreelancer)
  ) {
    actions.push(
      actionBtn("Raise dispute", "dispute", "btn-danger", () =>
        program()
          .methods.raiseDispute()
          .accounts({ escrow: escrow.publicKey, authority: publicKey! })
          .rpc(),
        {
          title: "Raise a dispute?",
          message: (
            <>
              Raise a dispute over <strong>{amountStr}</strong>? Only the
              arbiter can resolve it, and their decision is final.
            </>
          ),
          confirmLabel: "Raise dispute",
          danger: true,
        }
      )
    );
  }
  if (status === "Disputed" && isArbiter) {
    actions.push(
      actionBtn("Resolve: pay freelancer", "resolve-yes", "btn-success", async () =>
        resolve(true),
        {
          title: "Resolve dispute?",
          message: (
            <>
              Pay <strong>{amountStr}</strong> to the freelancer? This is
              final and cannot be undone.
            </>
          ),
          confirmLabel: "Pay freelancer",
          danger: true,
        }
      ),
      actionBtn("Resolve: refund client", "resolve-no", "btn-danger", async () =>
        resolve(false),
        {
          title: "Resolve dispute?",
          message: (
            <>
              Refund <strong>{amountStr}</strong> to the client? This is
              final and cannot be undone.
            </>
          ),
          confirmLabel: "Refund client",
          danger: true,
        }
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
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            You are the {roleLabel}
          </span>
        </div>
        <button className="btn btn-ghost" onClick={() => { setLoading(true); setRefreshKey((k) => k + 1); }} disabled={busy !== null}>
          ↻ Refresh
        </button>
      </div>

      <div className="card">
        <Timeline status={escrow.status} />
        <dl className="kv">
          <dt>Escrow address</dt>
          <dd>
            <ExplorerAddr addr={escrow.publicKey.toBase58()} />
          </dd>
          <dt>Client</dt>
          <dd>
            <ExplorerAddr addr={escrow.client.toBase58()} />
          </dd>
          <dt>Freelancer</dt>
          <dd>
            <ExplorerAddr addr={escrow.freelancer.toBase58()} />
          </dd>
          <dt>Arbiter</dt>
          <dd>
            <ExplorerAddr addr={escrow.arbiter.toBase58()} />
          </dd>
          <dt>Token mint</dt>
          <dd>
            <ExplorerAddr addr={escrow.mint.toBase58()} />
          </dd>
          <dt>Deadline</dt>
          <dd>
            {formatDeadline(escrow.deadline)}
            {pastDeadline && (status === "Funded" || status === "InProgress" || status === "Delivered") && (
              <span style={{ color: "var(--warning)", marginLeft: 8 }}>· passed</span>
            )}
          </dd>
          <dt>Seed</dt>
          <dd className="addr">{new BN(escrow.seed.toString()).toString()}</dd>
        </dl>

        {notice && (
          <div className={`notice ${notice.kind}`}>
            {notice.text}
            {notice.sig && (
              <>
                {" "}
                <a
                  href={`https://explorer.solana.com/tx/${notice.sig}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  View on explorer ↗
                </a>
              </>
            )}
          </div>
        )}

        {actions.length > 0 && <div className="actions">{actions}</div>}

        {status === "Funded" && isClient && (
          <div className="notice notice-info">
            Refund is only available until the freelancer accepts the job. After
            that, funds move only via release, deadline claim, or arbiter
            resolution.
          </div>
        )}

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
