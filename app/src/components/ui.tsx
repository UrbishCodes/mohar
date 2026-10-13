import { useState } from "react";
import { statusName, type EscrowAccount } from "../lib/mohar";
import { shortAddr } from "../lib/format";

/* ---------- inline icons (from the design board) ---------- */
const P = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  alert:
    '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: P[name] }}
    />
  );
}

/* ---------- status pill — dot plus label, never colour alone ---------- */
const PILL_LABEL: Record<string, string> = {
  Funded: "Funded",
  InProgress: "In progress",
  Delivered: "Delivered",
  Released: "Released",
  Disputed: "Disputed",
  Refunded: "Refunded",
  Resolved: "Resolved",
};

export function StatusPill({ status }: { status: EscrowAccount["status"] }) {
  const name = statusName(status);
  return (
    <span className={`pill pill-${name.toLowerCase()}`}>
      {PILL_LABEL[name] ?? name}
    </span>
  );
}

/* ---------- role / attention chips ---------- */
export function Chip({
  children,
  move = false,
}: {
  children: React.ReactNode;
  move?: boolean;
}) {
  return <span className={`chip${move ? " chip-move" : ""}`}>{children}</span>;
}

/* ---------- notices ---------- */
export function Notice({
  kind,
  icon,
  children,
}: {
  kind: "info" | "warn" | "error" | "ok";
  icon?: IconName;
  children: React.ReactNode;
}) {
  const fallback: Record<string, IconName> = {
    info: "info",
    warn: "clock",
    error: "alert",
    ok: "check",
  };
  return (
    <div className={`notice notice-${kind}`}>
      <Icon name={icon ?? fallback[kind]} />
      <span>{children}</span>
    </div>
  );
}

/* ---------- form field ---------- */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>
        {label}
        <span style={{ display: "block", marginTop: 6 }}>
          {children}
        </span>
      </label>
      {hint && !error && <div className="hint">{hint}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

/* ---------- address: short by default, copy + explorer actions ---------- */
export function Addr({
  addr,
  cluster = "devnet",
}: {
  addr: string;
  cluster?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <span className="addr" title={addr}>
      {shortAddr(addr)}
      <button
        className="ib"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy full address"}
        title={copied ? "Copied" : "Copy full address"}
      >
        {copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}
      </button>
      <a
        className="ib"
        href={`https://explorer.solana.com/address/${addr}?cluster=${cluster}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Open in Solana explorer"
        title="Open in Solana explorer"
      >
        <Icon name="ext" size={14} />
      </a>
    </span>
  );
}

/* ---------- route tracker — built from the actual deal path ----------
   NOTE: the board's scenario map omits InProgress, but the program really
   has it (acceptJob → InProgress → markDelivered), so the tracker includes
   it between Funded and Delivered. */
type NodeState = "done" | "now" | "todo" | "bad" | "neutral";

interface RNode {
  state: NodeState;
  label: string;
  sub: string;
}

interface Route {
  nodes: RNode[];
  exits: [string, string][];
  settled?: boolean;
}

const DONE_FUNDED: RNode = { state: "done", label: "Funded", sub: "Client locked USDC" };

export function routeFor(status: string): Route {
  switch (status) {
    case "Funded":
      return {
        nodes: [
          { state: "now", label: "Funded", sub: "Client locked USDC" },
          { state: "todo", label: "In progress", sub: "Freelancer accepts" },
          { state: "todo", label: "Delivered", sub: "Freelancer marks it" },
          { state: "todo", label: "Released", sub: "Client releases" },
        ],
        exits: [
          ["Refund", "client, before accept"],
          ["Dispute", "client or freelancer"],
        ],
      };
    case "InProgress":
      return {
        nodes: [
          DONE_FUNDED,
          { state: "now", label: "In progress", sub: "Freelancer accepted" },
          { state: "todo", label: "Delivered", sub: "Freelancer marks it" },
          { state: "todo", label: "Released", sub: "Client releases" },
        ],
        exits: [
          ["Dispute", "client or freelancer"],
          ["Claim after deadline", "freelancer"],
        ],
      };
    case "Delivered":
      return {
        nodes: [
          DONE_FUNDED,
          { state: "done", label: "In progress", sub: "Freelancer accepted" },
          { state: "now", label: "Delivered", sub: "Freelancer marked it" },
          { state: "todo", label: "Released", sub: "Client releases" },
        ],
        exits: [
          ["Dispute", "client or freelancer"],
          ["Claim after deadline", "freelancer"],
        ],
      };
    case "Released":
      return {
        nodes: [
          DONE_FUNDED,
          { state: "done", label: "In progress", sub: "Freelancer accepted" },
          { state: "done", label: "Delivered", sub: "Freelancer marked it" },
          { state: "done", label: "Released", sub: "Paid to freelancer" },
        ],
        exits: [],
        settled: true,
      };
    case "Disputed":
      return {
        nodes: [
          DONE_FUNDED,
          { state: "bad", label: "Disputed", sub: "Raised by a party" },
          { state: "todo", label: "Resolved", sub: "Arbiter decides" },
        ],
        exits: [
          ["Pay freelancer", "arbiter"],
          ["Refund client", "arbiter"],
        ],
      };
    case "Refunded":
      return {
        nodes: [
          DONE_FUNDED,
          { state: "neutral", label: "Refunded", sub: "Returned to client" },
        ],
        exits: [],
        settled: true,
      };
    case "Resolved":
      return {
        nodes: [
          DONE_FUNDED,
          { state: "done", label: "Disputed", sub: "Raised by a party" },
          { state: "done", label: "Resolved", sub: "Arbiter decided" },
        ],
        exits: [],
        settled: true,
      };
    default:
      return { nodes: [], exits: [] };
  }
}

export function RouteTracker({ status }: { status: string }) {
  const route = routeFor(status);
  return (
    <div className="trk">
      <div className="route">
        {route.nodes.map((n, i) => (
          <div key={i} className={`rn ${n.state}`}>
            <span className="dot">
              {n.state === "done" || n.state === "neutral" ? (
                <Icon name="check" size={16} />
              ) : n.state === "bad" ? (
                <Icon name="alert" size={16} />
              ) : (
                i + 1
              )}
            </span>
            <b>{n.label}</b>
            <small>{n.sub}</small>
          </div>
        ))}
      </div>
      <div className="exits">
        {route.exits.length > 0 ? (
          <>
            <span>Or</span>
            {route.exits.map(([label, who]) => (
              <span key={label} className="exit">
                <b>{label}</b> · {who}
              </span>
            ))}
          </>
        ) : (
          route.settled && <span>Settled. No further actions.</span>
        )}
      </div>
    </div>
  );
}

/* mini route bar for escrow cards */
const MINI: Record<string, string[]> = {
  Funded: ["now", "", "", ""],
  InProgress: ["on", "now", "", ""],
  Delivered: ["on", "on", "now", ""],
  Released: ["on", "on", "on", "on"],
  Disputed: ["on", "bad", "", ""],
  Refunded: ["on", "neutral", "", ""],
  Resolved: ["on", "bad", "neutral", ""],
};

export function MiniRoute({ status }: { status: string }) {
  const segs = MINI[status] ?? ["", "", "", ""];
  return (
    <div className="mini" aria-hidden="true">
      {segs.map((c, i) => (
        <i key={i} className={c} />
      ))}
    </div>
  );
}
