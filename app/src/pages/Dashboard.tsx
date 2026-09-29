import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import type { View } from "../components/TopBar";
import { getProgram, statusName, type EscrowAccount } from "../lib/mohar";
import { StatusPill, Timeline, formatAmount, formatDeadline, shortAddr } from "../components/ui";

export function EscrowCard({
  escrow,
  role,
  onOpen,
}: {
  escrow: EscrowAccount;
  role: string;
  onOpen: () => void;
}) {
  const name = statusName(escrow.status);
  return (
    <div className="card escrow-card" onClick={onOpen}>
      <div className="row">
        <span className="amount">{formatAmount(escrow.amount)} USDC</span>
        <StatusPill status={escrow.status} />
      </div>
      <Timeline status={escrow.status} />
      <div className="row">
        <span className="label">Role</span>
        <span className="value">{role}</span>
      </div>
      <div className="row">
        <span className="label">Counterparty</span>
        <span className="addr value">
          {shortAddr((role === "Client" ? escrow.freelancer : escrow.client).toBase58())}
        </span>
      </div>
      <div className="row">
        <span className="label">Deadline</span>
        <span className="value">
          {name === "Released" || name === "Refunded" || name === "Resolved"
            ? "—"
            : formatDeadline(escrow.deadline)}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard({ go }: { go: (v: View) => void }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [escrows, setEscrows] = useState<EscrowAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "client" | "freelancer">("all");

  const load = useCallback(async () => {
    if (!wallet.publicKey) return;
    setLoading(true);
    try {
      const program = getProgram(connection, wallet);
      const all = await program.account.escrow.all();
      const normalized = (
        all as { publicKey: PublicKey; account: object }[]
      ).map(
        (e: { publicKey: PublicKey; account: object }) =>
          ({ publicKey: e.publicKey, ...e.account } as EscrowAccount)
      );
      const mine = normalized.filter(
        (e) =>
          e.client.equals(wallet.publicKey!) ||
          e.freelancer.equals(wallet.publicKey!)
      );
      mine.sort((a, b) => b.deadline.toNumber() - a.deadline.toNumber());
      setEscrows(mine);
    } catch (err) {
      console.error("Failed to load escrows:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!wallet.publicKey) return [];
    if (tab === "client")
      return escrows.filter((e) => e.client.equals(wallet.publicKey!));
    if (tab === "freelancer")
      return escrows.filter((e) => e.freelancer.equals(wallet.publicKey!));
    return escrows;
  }, [escrows, tab, wallet.publicKey]);

  const roleOf = (e: EscrowAccount) =>
    e.client.equals(wallet.publicKey!) ? "Client" : "Freelancer";

  if (!wallet.connected) {
    return (
      <div className="page">
        <div className="empty">
          <div className="big">🔒</div>
          <h2>Connect your wallet</h2>
          <p>Connect a Solana wallet to see your escrows.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="detail-head">
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Your escrows</h2>
          <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 14 }}>
            Deals where you are the client or the freelancer.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? <span className="spinner" /> : "↻ Refresh"}
          </button>
          <button className="btn btn-primary" onClick={() => go({ name: "create" })}>
            + New escrow
          </button>
        </div>
      </div>

      <div className="tabs">
        {(["all", "client", "freelancer"] as const).map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "all" ? "All" : t === "client" ? "As client" : "As freelancer"}
          </button>
        ))}
      </div>

      {loading && escrows.length === 0 ? (
        <div className="empty">
          <span className="spinner" /> Loading escrows…
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="big">📭</div>
          <h3>No escrows yet</h3>
          <p>Start your first sealed deal.</p>
          <button className="btn btn-primary" onClick={() => go({ name: "create" })}>
            Create escrow
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((e) => (
            <EscrowCard
              key={e.publicKey.toBase58()}
              escrow={e}
              role={roleOf(e)}
              onOpen={() => go({ name: "detail", escrow: e.publicKey.toBase58() })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
