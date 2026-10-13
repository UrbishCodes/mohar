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
  type EscrowStatusName,
} from "../lib/mohar";
import {
  StatusPill,
  RouteTracker,
  Addr,
  Chip,
  Notice,
  Icon,
} from "../components/ui";
import { TxModal, type TxAction, type TxModalState } from "../components/TxModals";
import { formatAmount, formatDeadline } from "../lib/format";
import type { Role } from "../lib/moves";

interface PanelAction {
  pri: { label: string; cls: string; def: TxAction } | null;
  sec: { label: string; cls: string; def: TxAction }[];
}

interface Panel {
  h: string;
  p: string;
  actions: PanelAction;
}

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [barOpen, setBarOpen] = useState(false);
  const [txModal, setTxModal] = useState<TxModalState | null>(null);
  const [txBusy, setTxBusy] = useState(false);

  const fetchEscrow = useCallback(async (): Promise<EscrowAccount> => {
    const program = getProgram(connection, wallet);
    const acct = await withRetry(() =>
      program.account.escrow.fetch(new PublicKey(escrowKey))
    );
    return {
      publicKey: new PublicKey(escrowKey),
      ...(acct as object),
    } as EscrowAccount;
  }, [connection, wallet, escrowKey]);

  useEffect(() => {
    let ignore = false;
    fetchEscrow()
      .then((data) => {
        if (!ignore) {
          setEscrow(data);
          setLoadError(null);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!ignore)
          setLoadError("Could not load this escrow. Check the address and cluster.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [fetchEscrow, refreshKey]);

  const ensureAta = async (
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> => {
    return getOrCreateAta(connection, publicKey!, mint, owner, async (tx: Transaction) => {
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    });
  };

  const refresh = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  /* ---------- transaction modal driver ---------- */
  const openReview = (def: TxAction) => setTxModal({ stage: "review", action: def });

  const confirmTx = async () => {
    if (!txModal || txModal.stage !== "review" || txBusy) return;
    const action = txModal.action;
    setTxBusy(true);
    setTxModal({ stage: "progress", action, phase: 1 });
    try {
      const sig = await action.run();
      setTxModal({ stage: "progress", action, phase: 2 });
      await connection.confirmTransaction(sig, "confirmed");
      setTxModal({ stage: "sealed", action, sig });
      refresh();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setTxModal({
        stage: "error",
        action,
        message: msg.length > 300 ? msg.slice(0, 300) + "…" : msg,
      });
    } finally {
      setTxBusy(false);
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

  if (!escrow || loadError) {
    return (
      <div className="page">
        <Notice kind="error">{loadError ?? "Escrow not found."}</Notice>
        <button className="btn" onClick={() => go({ name: "dashboard" })}>
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const status = statusName(escrow.status);
  const role: Role = !publicKey
    ? "Viewer"
    : escrow.client.equals(publicKey)
    ? "Client"
    : escrow.freelancer.equals(publicKey)
    ? "Freelancer"
    : escrow.arbiter.equals(publicKey)
    ? "Arbiter"
    : "Viewer";
  const pastDeadline = Date.now() / 1000 >= escrow.deadline.toNumber();
  const amountStr = `${formatAmount(escrow.amount)} USDC`;
  const program = () => getProgram(connection, wallet);
  const vaultOf = async () => (await findVaultPda(escrow.publicKey))[0];

  /* ---------- action definitions (all go through review → progress → seal) ---------- */
  const mk = (
    key: string,
    label: string,
    btnClass: string,
    review: Omit<TxAction, "key" | "run">,
    run: () => Promise<string>
  ): { label: string; cls: string; def: TxAction } => ({
    label,
    cls: btnClass,
    def: { key, run, ...review },
  });

  const A = {
    accept: mk(
      "accept",
      "Accept job",
      "btn-primary",
      {
        title: "Accept this job?",
        sub: "Check the details. This cannot be undone.",
        rows: [
          ["Escrow", <Addr key="e" addr={escrow.publicKey.toBase58()} />],
          ["Amount", <b key="a">{amountStr}</b>],
          ["Client", <Addr key="c" addr={escrow.client.toBase58()} />],
        ],
        warning:
          "Once accepted, the client can no longer cancel — funds move only via release, deadline claim, or arbiter decision.",
        confirmLabel: "Accept job",
        confirmClass: "btn-primary",
        sealedTitle: "Job accepted",
        sealedSub: `The deal is on. Deliver the work, then mark it delivered.`,
        sealedStatus: "InProgress" as EscrowStatusName,
      },
      () =>
        program()
          .methods.acceptJob()
          .accounts({ escrow: escrow.publicKey, freelancer: publicKey! })
          .rpc()
    ),
    deliver: mk(
      "deliver",
      "Mark as delivered",
      "btn-primary",
      {
        title: "Mark as delivered?",
        sub: "Check the details. This cannot be undone.",
        rows: [
          ["Escrow", <Addr key="e" addr={escrow.publicKey.toBase58()} />],
          ["Amount", <b key="a">{amountStr}</b>],
        ],
        warning: "The client can then release the funds to you.",
        confirmLabel: "Mark delivered",
        confirmClass: "btn-primary",
        sealedTitle: "Marked delivered",
        sealedSub: "The client has been notified. Waiting on their release.",
        sealedStatus: "Delivered" as EscrowStatusName,
      },
      () =>
        program()
          .methods.markDelivered()
          .accounts({ escrow: escrow.publicKey, freelancer: publicKey! })
          .rpc()
    ),
    refund: mk(
      "refund",
      "Refund",
      "btn-danger",
      {
        title: `Refund ${amountStr}?`,
        sub: "Check the details. This cannot be undone.",
        rows: [
          ["From vault", <Addr key="v" addr={escrow.publicKey.toBase58()} />],
          ["To you", <Addr key="c" addr={escrow.client.toBase58()} />],
          ["Amount", <b key="a">{amountStr}</b>],
          ["Network fee", <span key="f">Paid in SOL</span>],
        ],
        warning: "The escrow is cancelled and the funds return to you.",
        confirmLabel: `Refund ${amountStr}`,
        confirmClass: "btn-destructive",
        sealedTitle: "Refunded",
        sealedSub: `${amountStr} is back in your wallet.`,
        sealedStatus: "Refunded" as EscrowStatusName,
      },
      async () => {
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
      }
    ),
    release: mk(
      "release",
      "Release payment",
      "btn-success",
      {
        title: `Release ${amountStr}?`,
        sub: "Check the details. This cannot be undone.",
        rows: [
          ["From vault", <Addr key="v" addr={escrow.publicKey.toBase58()} />],
          ["To freelancer", <Addr key="f" addr={escrow.freelancer.toBase58()} />],
          ["Amount", <b key="a">{amountStr}</b>],
          ["Network fee", <span key="f2">Paid in SOL</span>],
        ],
        warning:
          "The freelancer receives the full amount. A dispute is no longer possible after release.",
        confirmLabel: `Release ${amountStr}`,
        confirmClass: "btn-success",
        sealedTitle: "Payment released",
        sealedSub: `${amountStr} is now in the freelancer's wallet.`,
        sealedStatus: "Released" as EscrowStatusName,
      },
      async () => {
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
      }
    ),
    claim: mk(
      "claim",
      "Claim funds",
      "btn-primary",
      {
        title: `Claim ${amountStr}?`,
        sub: "Check the details. This cannot be undone.",
        rows: [
          ["From vault", <Addr key="v" addr={escrow.publicKey.toBase58()} />],
          ["To you", <Addr key="f" addr={escrow.freelancer.toBase58()} />],
          ["Amount", <b key="a">{amountStr}</b>],
          ["Network fee", <span key="f2">Paid in SOL</span>],
        ],
        warning: "The deadline passed with no release. The funds are yours to claim.",
        confirmLabel: "Claim funds",
        confirmClass: "btn-primary",
        sealedTitle: "Funds claimed",
        sealedSub: `${amountStr} is now in your wallet.`,
        sealedStatus: "Released" as EscrowStatusName,
      },
      async () => {
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
      }
    ),
    reclaim: mk(
      "reclaim",
      "Reclaim funds",
      "btn-danger",
      {
        title: `Reclaim ${amountStr}?`,
        sub: "Check the details. This cannot be undone.",
        rows: [
          ["From vault", <Addr key="v" addr={escrow.publicKey.toBase58()} />],
          ["To you", <Addr key="c" addr={escrow.client.toBase58()} />],
          ["Amount", <b key="a">{amountStr}</b>],
        ],
        warning: "The freelancer never accepted this job. The funds return to you.",
        confirmLabel: "Reclaim funds",
        confirmClass: "btn-destructive",
        sealedTitle: "Reclaimed",
        sealedSub: `${amountStr} is back in your wallet.`,
        sealedStatus: "Refunded" as EscrowStatusName,
      },
      async () => {
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
      }
    ),
    dispute: mk(
      "dispute",
      "Raise dispute",
      "btn-danger",
      {
        title: `Raise a dispute over ${amountStr}?`,
        sub: "Check the details. This cannot be undone.",
        rows: [
          ["Escrow", <Addr key="e" addr={escrow.publicKey.toBase58()} />],
          ["Amount", <b key="a">{amountStr}</b>],
        ],
        warning:
          "Only the arbiter can resolve it, and their decision is final.",
        confirmLabel: "Raise dispute",
        confirmClass: "btn-destructive",
        sealedTitle: "Dispute raised",
        sealedSub: "The arbiter has been notified. They decide where the funds go.",
        sealedStatus: "Disputed" as EscrowStatusName,
      },
      () =>
        program()
          .methods.raiseDispute()
          .accounts({ escrow: escrow.publicKey, authority: publicKey! })
          .rpc()
    ),
  };

  const resolveAction = (payFreelancer: boolean) =>
    mk(
      payFreelancer ? "resolve-yes" : "resolve-no",
      payFreelancer ? "Pay the freelancer" : "Refund the client",
      payFreelancer ? "btn-success" : "btn-danger",
      {
        title: "Resolve dispute?",
        sub: "Check the details. This is final and cannot be undone.",
        rows: [
          ["Escrow", <Addr key="e" addr={escrow.publicKey.toBase58()} />],
          ["Decision", <b key="d">{payFreelancer ? "Pay the freelancer" : "Refund the client"}</b>],
          ["Amount", <b key="a">{amountStr}</b>],
        ],
        confirmLabel: payFreelancer ? "Pay freelancer" : "Refund client",
        confirmClass: payFreelancer ? "btn-success" : "btn-destructive",
        sealedTitle: "Dispute resolved",
        sealedSub: payFreelancer
          ? `${amountStr} was paid to the freelancer.`
          : `${amountStr} was refunded to the client.`,
        sealedStatus: "Resolved" as EscrowStatusName,
      },
      async () => {
        const vault = await vaultOf();
        const freelancerAta = await ensureAta(escrow.mint, escrow.freelancer);
        const clientAta = await ensureAta(escrow.mint, escrow.client);
        return program()
          .methods.resolveDispute(payFreelancer)
          .accounts({
            escrow: escrow.publicKey,
            arbiter: publicKey!,
            vault,
            client: escrow.client,
            freelancerAta,
            clientAta,
            tokenProgram: tokenProgramId,
          })
          .rpc();
      }
    );

  /* ---------- action panel: role × status → one headline + actions ---------- */
  const panel = (): Panel => {
    const noActions = { pri: null, sec: [] } as PanelAction;
    if (status === "Released")
      return {
        h: "Settled",
        p: `${amountStr} was released to the freelancer. Nothing left to do.`,
        actions: noActions,
      };
    if (status === "Refunded")
      return {
        h: "Settled",
        p: `${amountStr} was refunded to the client. Nothing left to do.`,
        actions: noActions,
      };
    if (status === "Resolved")
      return {
        h: "Settled",
        p: `${amountStr} was paid out by the arbiter. Nothing left to do.`,
        actions: noActions,
      };
    if (role === "Viewer")
      return {
        h: "Read only",
        p: "Connect the client, freelancer or arbiter wallet to take action on this escrow.",
        actions: noActions,
      };
    if (status === "Disputed") {
      if (role === "Arbiter")
        return {
          h: "Your move",
          p: "Review both sides, then decide where the funds go. A decision is final.",
          actions: {
            pri: resolveAction(true),
            sec: [resolveAction(false)],
          },
        };
      return {
        h: "Waiting on the arbiter",
        p: "A dispute is open. Only the arbiter can resolve it.",
        actions: noActions,
      };
    }
    if (role === "Arbiter")
      return {
        h: "You are the arbiter",
        p: "Nothing to do unless a dispute is raised. You will see it here.",
        actions: noActions,
      };

    const disp = A.dispute;
    if (status === "Funded") {
      if (role === "Freelancer") {
        if (pastDeadline)
          return {
            h: "Your move",
            p: "The deadline passed with no release. You can claim the full amount.",
            actions: { pri: A.claim, sec: [disp] },
          };
        return {
          h: "Your move",
          p: "Accept the job to begin. Once accepted, the client can no longer cancel.",
          actions: { pri: A.accept, sec: [disp] },
        };
      }
      // client
      if (pastDeadline)
        return {
          h: "Your move",
          p: "The deadline passed and the job was never accepted. Reclaim your funds.",
          actions: { pri: A.reclaim, sec: [] },
        };
      return {
        h: "Waiting on the freelancer",
        p: `${amountStr} is locked. You can refund it until the work is accepted.`,
        actions: { pri: null, sec: [A.refund, disp] },
      };
    }
    if (status === "InProgress") {
      if (role === "Freelancer") {
        if (pastDeadline)
          return {
            h: "Your move",
            p: "The deadline passed and the client has not released. You can claim the full amount.",
            actions: { pri: A.claim, sec: [disp] },
          };
        return {
          h: "Your move",
          p: "Ship the work, then mark it delivered so the client can release payment.",
          actions: { pri: A.deliver, sec: [disp] },
        };
      }
      return {
        h: "Waiting on delivery",
        p: "The freelancer accepted the job. You will be able to release once it is marked delivered.",
        actions: { pri: null, sec: [disp] },
      };
    }
    // Delivered
    if (role === "Client")
      return {
        h: "Your move",
        p: "The freelancer says the work is delivered. Release payment, or raise a dispute if it is not right.",
        actions: { pri: A.release, sec: [disp] },
      };
    if (pastDeadline)
      return {
        h: "Your move",
        p: "The client has not released and the deadline passed. You can claim the full amount.",
        actions: { pri: A.claim, sec: [disp] },
      };
    return {
      h: "Waiting on the client",
      p: "Marked delivered. If the client stays silent past the deadline you can claim.",
      actions: { pri: null, sec: [disp] },
    };
  };

  const pn = panel();
  const hasBar = !!(pn.actions.pri || pn.actions.sec.length > 0);
  const active = status === "Funded" || status === "InProgress" || status === "Delivered";
  const you = (r: Role) => (role === r ? " you" : "");

  const renderPanel = (compact: boolean) => (
    <div className="ap">
      <h4>{pn.h}</h4>
      <p>{pn.p}</p>
      {pn.actions.pri && (
        <button
          className={`btn ${pn.actions.pri.cls} btn-block${compact ? "" : " btn-lg"}`}
          disabled={txBusy || !wallet.connected}
          onClick={() => openReview(pn.actions.pri!.def)}
        >
          {pn.actions.pri.label}
        </button>
      )}
      {pn.actions.sec.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {pn.actions.sec.map((s) => (
            <button
              key={s.def.key}
              className={`btn btn-sm ${s.cls}`}
              style={{ flex: 1 }}
              disabled={txBusy || !wallet.connected}
              onClick={() => openReview(s.def)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {(pn.actions.pri || pn.actions.sec.length > 0) && (
        <p className="fine">
          Each action opens a review step before anything is sent to your wallet.
        </p>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className={`dt${hasBar ? " has-bar" : ""}`}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
            margin: "28px 0 18px",
          }}
        >
          <div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: 0 }}
              onClick={() => go({ name: "dashboard" })}
            >
              ← Dashboard
            </button>
            <div className="amt" style={{ fontSize: 44, margin: "6px 0" }}>
              {formatAmount(escrow.amount)}
              <small style={{ fontSize: 16 }}>USDC</small>
            </div>
            <div
              style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
            >
              <StatusPill status={escrow.status} />
              <Chip>You are the {role}</Chip>
            </div>
          </div>
          <button
            className="btn btn-sm"
            onClick={refresh}
            disabled={txBusy}
          >
            ↻ Refresh
          </button>
        </div>

        <div className="dt-grid">
          <div style={{ display: "grid", gap: 16 }}>
            <Notice kind={pastDeadline && active ? "warn" : "info"} icon="clock">
              {active
                ? pastDeadline
                  ? `Deadline passed on ${formatDeadline(escrow.deadline)}. ${
                      role === "Freelancer"
                        ? "You can now claim these funds."
                        : role === "Client" && status === "Funded"
                        ? "You can now reclaim these funds."
                        : "The deadline rules decide who gets paid."
                    }`
                  : `Deadline ${formatDeadline(escrow.deadline)}. After this the freelancer can claim on an accepted job.`
                : "Settled. No deadline."}
            </Notice>

            <div className="card">
              <div
                style={{
                  font: "600 12px/1 var(--ui)",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 16,
                }}
              >
                Progress
              </div>
              <RouteTracker status={status} />
            </div>

            <div className="card">
              <div
                style={{
                  font: "600 12px/1 var(--ui)",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 8,
                }}
              >
                Parties
              </div>
              <div className={`party${you("Client")}`}>
                <b>Client</b>
                <Addr addr={escrow.client.toBase58()} />
              </div>
              <div className={`party${you("Freelancer")}`}>
                <b>Freelancer</b>
                <Addr addr={escrow.freelancer.toBase58()} />
              </div>
              <div className={`party${you("Arbiter")}`}>
                <b>Arbiter</b>
                <Addr addr={escrow.arbiter.toBase58()} />
              </div>
            </div>

            <details className="card" style={{ padding: "14px 20px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                On-chain details
              </summary>
              <div className="rows" style={{ marginBottom: 0 }}>
                <div>
                  <span>Escrow account</span>
                  <Addr addr={escrow.publicKey.toBase58()} />
                </div>
                <div>
                  <span>Token mint</span>
                  <Addr addr={escrow.mint.toBase58()} />
                </div>
                <div>
                  <span>Seed</span>
                  <span className="addr">
                    {new BN(escrow.seed.toString()).toString()}
                  </span>
                </div>
              </div>
            </details>

            {!wallet.connected && (
              <Notice kind="warn">
                Connect your wallet to take action on this escrow.
              </Notice>
            )}
          </div>

          <aside className="dt-side">
            <div className="card card-raised">{renderPanel(false)}</div>
          </aside>
        </div>

        {hasBar && (
          <div className={`dt-drawer${barOpen ? " open" : ""}`}>
            <div className="bar-row">
              <div className="bar-txt">
                <b>{pn.h}</b>
                <span>{pn.p}</span>
              </div>
              {pn.actions.pri && (
                <button
                  className={`btn ${pn.actions.pri.cls}`}
                  disabled={txBusy || !wallet.connected}
                  onClick={() => openReview(pn.actions.pri!.def)}
                >
                  {pn.actions.pri.label}
                </button>
              )}
              <button
                className="btn bar-tog"
                type="button"
                aria-expanded={barOpen}
                aria-label={pn.actions.pri ? "More options" : "Options"}
                onClick={() => setBarOpen((o) => !o)}
              >
                <Icon name="chevD" size={18} />
              </button>
            </div>
            <div className="bar-x">
              <p>{pn.p}</p>
              <div className="bar-sec">
                {pn.actions.sec.map((s) => (
                  <button
                    key={s.def.key}
                    className={`btn btn-sm ${s.cls}`}
                    disabled={txBusy || !wallet.connected}
                    onClick={() => openReview(s.def)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="fine">
                Each action opens a review step before anything is sent to
                your wallet.
              </p>
            </div>
          </div>
        )}
      </div>

      {txModal && (
        <TxModal
          state={txModal}
          onClose={() => !txBusy && setTxModal(null)}
          onConfirm={confirmTx}
          onRetry={confirmTx}
        />
      )}
    </div>
  );
}
