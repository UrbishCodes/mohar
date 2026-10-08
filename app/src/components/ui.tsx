import { statusName } from "../lib/mohar";
import type { EscrowAccount, EscrowStatusName } from "../lib/mohar";

export function StatusPill({ status }: { status: EscrowAccount["status"] }) {
  const name = statusName(status);
  return <span className={`pill pill-${name.toLowerCase()}`}>{name}</span>;
}

const FLOW: { key: EscrowStatusName; label: string }[] = [
  { key: "Funded", label: "Funded" },
  { key: "Delivered", label: "Delivered" },
  { key: "Released", label: "Released" },
];

export function Timeline({ status }: { status: EscrowAccount["status"] }) {
  const name = statusName(status);
  const terminal = name === "Released" || name === "Refunded" || name === "Resolved";
  const disputed = name === "Disputed";

  let steps = FLOW.map((s) => ({ ...s, state: "" as string }));
  if (terminal) {
    steps = steps.map((s, i) => ({
      ...s,
      label: i === 2 ? (name === "Refunded" ? "Refunded" : "Resolved") : s.label,
      state: "done",
    }));
  } else if (disputed) {
    steps = [
      { key: "Funded", label: "Funded", state: "done" },
      { key: "Disputed", label: "Disputed", state: "now" },
      { key: "Released", label: "Settled", state: "" },
    ];
  } else {
    const idx = FLOW.findIndex((s) => s.key === name);
    steps = steps.map((s, i) => ({
      ...s,
      state: i < idx ? "done" : i === idx ? "now" : "",
    }));
  }

  return (
    <div className="timeline">
      {steps.map((s, i) => (
        <div key={i} className={`t-step ${s.state}`}>
          <div className="t-line" />
          <div className="t-dot">{s.state === "done" ? "✓" : i + 1}</div>
          <div className="t-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
