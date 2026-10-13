import { useEffect } from "react";
import { Icon, StatusPill } from "./ui";
import { shortAddr } from "../lib/format";
import type { EscrowStatusName } from "../lib/mohar";

/**
 * Review → progress → sealed around every money movement (design board v2).
 * Nothing is sent to the wallet before the review step is confirmed.
 */

export interface TxAction {
  key: string;
  /** review modal */
  title: string;
  sub: string;
  rows: [string, React.ReactNode][];
  warning?: React.ReactNode;
  confirmLabel: string;
  confirmClass?: "btn-primary" | "btn-success" | "btn-destructive";
  /** executes the transaction, resolves with the signature */
  run: () => Promise<string>;
  /** sealed modal */
  sealedTitle: string;
  sealedSub: string;
  sealedStatus: EscrowStatusName;
}

export type TxModalState =
  | { stage: "review"; action: TxAction }
  | { stage: "progress"; action: TxAction; phase: number }
  | { stage: "sealed"; action: TxAction; sig: string }
  | { stage: "error"; action: TxAction; message: string };

const PHASES: [string, string][] = [
  ["Prepare accounts", "Creates the freelancer token account if it is missing."],
  ["Approve in wallet", "Check the amount in your wallet, then approve."],
  ["Confirm on Solana", "Usually a few seconds."],
  ["Sealed", "The vault is closed and the status updates."],
];

function Shell({
  children,
  onClose,
  labelledBy,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  labelledBy: string;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="tx-overlay"
      onClick={onClose ? (e) => e.target === e.currentTarget && onClose() : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div className="modal">{children}</div>
    </div>
  );
}

export function TxModal({
  state,
  onClose,
  onConfirm,
  onRetry,
}: {
  state: TxModalState;
  onClose: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  if (state.stage === "review") {
    const a = state.action;
    return (
      <Shell onClose={onClose} labelledBy={`txr-${a.key}`}>
        <h3 id={`txr-${a.key}`}>{a.title}</h3>
        <p className="sub2">{a.sub}</p>
        <div className="rows">
          {a.rows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
        {a.warning && (
          <div className="notice notice-warn">
            <Icon name="alert" />
            <span>{a.warning}</span>
          </div>
        )}
        <div className="macts">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${a.confirmClass ?? "btn-primary"}`}
            onClick={onConfirm}
            autoFocus
          >
            {a.confirmLabel}
          </button>
        </div>
      </Shell>
    );
  }

  if (state.stage === "progress") {
    const { phase } = state;
    return (
      <Shell labelledBy="txp-title">
        <h3 id="txp-title">{state.action.title.replace(/\?$/, "")}</h3>
        <p className="sub2">Keep this tab open.</p>
        <ol className="steps">
          {PHASES.map(([label, sub], i) => (
            <li
              key={label}
              className={i < phase ? "done" : i === phase ? "now" : "wait"}
            >
              <span className="dot">
                {i < phase ? (
                  <Icon name="check" size={12} />
                ) : i === phase ? (
                  <span
                    className="spin"
                    style={{ width: 10, height: 10, borderWidth: 2 }}
                  />
                ) : null}
              </span>
              <div>
                <b>{label}</b>
                {i === phase && <small>{sub}</small>}
              </div>
            </li>
          ))}
        </ol>
      </Shell>
    );
  }

  if (state.stage === "sealed") {
    const a = state.action;
    return (
      <Shell onClose={onClose} labelledBy={`txs-${a.key}`}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "grid", placeItems: "center", margin: "8px 0 14px" }}>
            <span className="seal-check" role="img" aria-label="Sealed">
              <Icon name="check" size={30} />
            </span>
          </div>
          <h3 id={`txs-${a.key}`}>{a.sealedTitle}</h3>
          <p className="sub2">{a.sealedSub}</p>
        </div>
        <div className="rows" style={{ textAlign: "left" }}>
          <div>
            <span>Transaction</span>
            <span className="addr">
              {shortAddr(state.sig)}{" "}
              <a
                className="ib"
                href={`https://explorer.solana.com/tx/${state.sig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open in explorer"
              >
                <Icon name="ext" size={14} />
              </a>
            </span>
          </div>
          <div>
            <span>Status</span>
            <StatusPill status={a.sealedStatus} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={onClose} autoFocus>
          Back to escrow
        </button>
      </Shell>
    );
  }

  // error
  const a = state.action;
  return (
    <Shell onClose={onClose} labelledBy={`txe-${a.key}`}>
      <div className="notice notice-error" style={{ marginBottom: 14 }}>
        <Icon name="alert" />
        <span>
          <b>Transaction not sent.</b> Nothing was moved and your funds are
          still where they were.
        </span>
      </div>
      <h3 id={`txe-${a.key}`}>Try again?</h3>
      <p className="sub2">Your escrow is unchanged.</p>
      <details className="tech">
        <summary>Technical details</summary>
        <code>{state.message}</code>
      </details>
      <div className="macts">
        <button className="btn" onClick={onClose}>
          Close
        </button>
        <button className="btn btn-primary" onClick={onRetry} autoFocus>
          Try again
        </button>
      </div>
    </Shell>
  );
}
