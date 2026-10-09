import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import type { View } from "../components/TopBar";
import { getProgram, statusName, type EscrowAccount } from "../lib/mohar";
import { StatusPill, Timeline } from "../components/ui";
import { formatAmount, formatDeadline, shortAddr } from "../lib/format";

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
  const counterparty =
    role === "Client"
      ? shortAddr(escrow.freelancer.toBase58())
      : role === "Freelancer"
      ? shortAddr(escrow.client.toBase58())
      : `${shortAddr(escrow.client.toBase58())} - ${shortAddr(escrow.freelancer.toBase58())}`;
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
        <span className="label">
          {role === "Arbiter" ? "Parties" : "Counterparty"}
        </span>
        <span className="addr value">{counterparty}</span>
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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "client" | "freelancer" | "arbiter">(
    "all"
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchEscrows = useCallback(async (): Promise<EscrowAccount[]> => {
    if (!wallet.publicKey) return [];
    const program = getProgram(connection, wallet);
    const all = await program.account.escrow.all();
    const normalized = (
      all as { publicKey: PublicKey; account: object }[]
    ).map(
      (e: { publicKey: PublicKey; account: object }) =>
        ({ publicKey: e.publicKey, ...e.account } as EscrowAccount)
    );
    const me = wallet.publicKey;
    const mine = normalized.filter(
      (e) =>
        e.client.equals(me) ||
        e.freelancer.equals(me) ||
        e.arbiter.equals(me)
    );
    mine.sort((a, b) => b.deadline.toNumber() - a.deadline.toNumber());
    return mine;
  }, [connection, wallet]);

  useEffect(() => {
    if (!wallet.publicKey) return;
    let ignore = false;
    fetchEscrows()
      .then((mine) => {
        if (!ignore) setEscrows(mine);
      })
      .catch((err) => {
        console.error("Failed to load escrows:", err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [fetchEscrows, refreshKey, wallet.publicKey]);

  const filtered = useMemo(() => {
    if (!wallet.publicKey) return [];
    const me = wallet.publicKey;
    if (tab === "client") return escrows.filter((e) => e.client.equals(me));
    if (tab === "freelancer")
      return escrows.filter((e) => e.freelancer.equals(me));
    if (tab === "arbiter") return escrows.filter((e) => e.arbiter.equals(me));
    return escrows;
  }, [escrows, tab, wallet.publicKey]);

  const roleOf = (e: EscrowAccount) => {
    const me = wallet.publicKey!;
    if (e.client.equals(me)) return "Client";
    if (e.freelancer.equals(me)) return "Freelancer";
    if (e.arbiter.equals(me)) return "Arbiter";
    return "—";
  };

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

  const tabs: {
    key: "all" | "client" | "freelancer" | "arbiter";
    label: string;
  }[] = [
    { key: "all", label: "All" },
    { key: "client", label: "As client" },
    { key: "freelancer", label: "As freelancer" },
    { key: "arbiter", label: "As arbiter" },
  ];

  return (
    <div className="page">
      <div className="detail-head">
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Your escrows</h2>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
            Deals where you are the client, the freelancer, or the arbiter.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setLoading(true);
              setRefreshKey((k) => k + 1);
            }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "↻ Refresh"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => go({ name: "create" })}
          >
            + New escrow
          </button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
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
          <button
            className="btn btn-primary"
            onClick={() => go({ name: "create" })}
          >
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
              onOpen={() =>
                go({ name: "detail", escrow: e.publicKey.toBase58() })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}