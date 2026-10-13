import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import type { View } from "../components/TopBar";
import { getProgram, statusName, type EscrowAccount } from "../lib/mohar";
import { nextMove, isTerminal, type Role } from "../lib/moves";
import { StatusPill, MiniRoute, Chip, Icon } from "../components/ui";
import { formatAmount, formatDeadline, shortAddr } from "../lib/format";

function EscrowCard({
  escrow,
  role,
  onOpen,
}: {
  escrow: EscrowAccount;
  role: Role;
  onOpen: () => void;
}) {
  const name = statusName(escrow.status);
  const pastDeadline = Date.now() / 1000 >= escrow.deadline.toNumber();
  const nm = nextMove(escrow, role, pastDeadline);
  const settled = isTerminal(name);

  const counterparty =
    role === "Client"
      ? `to ${shortAddr(escrow.freelancer.toBase58())}`
      : role === "Freelancer"
      ? `from ${shortAddr(escrow.client.toBase58())}`
      : `${shortAddr(escrow.client.toBase58())} · ${shortAddr(
          escrow.freelancer.toBase58()
        )}`;

  return (
    <article
      className={`card ec${nm.move ? " move" : ""}`}
      tabIndex={0}
      role="link"
      aria-label={`${formatAmount(escrow.amount)} USDC, ${name}. ${nm.headline}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="ec-top">
        <div className="amt">
          {formatAmount(escrow.amount)}
          <small>USDC</small>
        </div>
        <StatusPill status={escrow.status} />
      </div>
      <div className="ec-next">{nm.headline}</div>
      <MiniRoute status={name} />
      <div className="ec-meta">
        <span className="chips">
          {nm.move && <Chip move>Your move</Chip>}
          <Chip>{role}</Chip>
        </span>
        <span className="addr">{counterparty}</span>
      </div>
      <div className="ec-foot">
        <span className={`dl${pastDeadline && !settled ? " late" : ""}`}>
          <Icon name="clock" size={14} />
          {settled ? "Settled" : formatDeadline(escrow.deadline)}
        </span>
        {nm.cta && (
          <button
            className="btn btn-sm btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            tabIndex={-1}
          >
            {nm.cta}
          </button>
        )}
      </div>
    </article>
  );
}

type AttnTab = "move" | "waiting" | "settled" | "all";

export default function Dashboard({ go }: { go: (v: View) => void }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [escrows, setEscrows] = useState<EscrowAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<AttnTab>("move");
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
        e.client.equals(me) || e.freelancer.equals(me) || e.arbiter.equals(me)
    );
    mine.sort((a, b) => b.deadline.toNumber() - a.deadline.toNumber());
    return mine;
  }, [connection, wallet]);

  useEffect(() => {
    if (!wallet.publicKey) return;
    let ignore = false;
    fetchEscrows()
      .then((mine) => {
        if (!ignore) {
          setEscrows(mine);
          setLoadError(null);
        }
      })
      .catch((err) => {
        console.error("Failed to load escrows:", err);
        if (!ignore)
          setLoadError(
            "Couldn't load your escrows. Check your connection and try again."
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [fetchEscrows, refreshKey, wallet.publicKey]);

  const roleOf = useCallback(
    (e: EscrowAccount): Role => {
      const me = wallet.publicKey!;
      if (e.client.equals(me)) return "Client";
      if (e.freelancer.equals(me)) return "Freelancer";
      if (e.arbiter.equals(me)) return "Arbiter";
      return "Viewer";
    },
    [wallet.publicKey]
  );

  const enriched = useMemo(
    () =>
      escrows.map((e) => {
        const role = roleOf(e);
        const pastDeadline = Date.now() / 1000 >= e.deadline.toNumber();
        return { e, role, nm: nextMove(e, role, pastDeadline) };
      }),
    [escrows, roleOf]
  );

  const counts = useMemo(() => {
    let move = 0,
      waiting = 0,
      settled = 0,
      locked = 0;
    for (const { e, nm } of enriched) {
      if (isTerminal(statusName(e.status))) settled++;
      else {
        locked += Number(e.amount.toString()) / 10 ** 6;
        if (nm.move) move++;
        else waiting++;
      }
    }
    return { move, waiting, settled, locked };
  }, [enriched]);

  const filtered = useMemo(() => {
    if (tab === "all") return enriched;
    if (tab === "move") return enriched.filter((x) => x.nm.move);
    if (tab === "settled")
      return enriched.filter((x) => isTerminal(statusName(x.e.status)));
    return enriched.filter(
      (x) => !x.nm.move && !isTerminal(statusName(x.e.status))
    );
  }, [enriched, tab]);

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

  const tabs: { key: AttnTab; label: string }[] = [
    { key: "move", label: `Needs my move · ${counts.move}` },
    { key: "waiting", label: `Waiting · ${counts.waiting}` },
    { key: "settled", label: `Settled · ${counts.settled}` },
    { key: "all", label: `All · ${enriched.length}` },
  ];

  return (
    <div className="page">
      <div className="page-wrap-cq">
        <div className="detail-head">
          <div>
            <h2 style={{ margin: "0 0 4px", font: "600 28px var(--display)" }}>
              Your escrows
            </h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
              Sorted by what needs you — not by role.
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

        <div className="dash-sum">
          <div className="sum">
            <span>Locked in escrow</span>
            <b>
              {counts.locked.toLocaleString("en-US", {
                maximumFractionDigits: 2,
              })}{" "}
              USDC
            </b>
          </div>
          <div className="sum" style={{ borderColor: "var(--primary)" }}>
            <span>Needs your move</span>
            <b>{counts.move}</b>
          </div>
          <div className="sum">
            <span>Settled</span>
            <b>{counts.settled}</b>
          </div>
        </div>

        <div className="tab-row" style={{ marginBottom: 16 }} role="group" aria-label="Filter escrows">
          {tabs.map((t) => (
            <button
              key={t.key}
              className="tabb"
              aria-pressed={tab === t.key}
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
        ) : loadError ? (
          <div className="empty">
            <div className="big">⚠️</div>
            <h3>Couldn't load escrows</h3>
            <p>{loadError}</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setLoading(true);
                setRefreshKey((k) => k + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="big">📭</div>
            <h3>
              {tab === "move"
                ? "Nothing needs you"
                : tab === "settled"
                ? "No settled escrows"
                : "No escrows yet"}
            </h3>
            <p>
              {tab === "move"
                ? "Every deal is waiting on someone else."
                : "Start your first sealed deal."}
            </p>
            {(tab === "all" || tab === "waiting") && (
              <button
                className="btn btn-primary"
                onClick={() => go({ name: "create" })}
              >
                Create escrow
              </button>
            )}
          </div>
        ) : (
          <div className="card-grid2" style={{ display: "grid", gap: 12 }}>
            {filtered.map(({ e, role }) => (
              <EscrowCard
                key={e.publicKey.toBase58()}
                escrow={e}
                role={role}
                onOpen={() =>
                  go({ name: "detail", escrow: e.publicKey.toBase58() })
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
