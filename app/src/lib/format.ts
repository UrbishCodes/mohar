export function shortAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export function formatAmount(
  raw: { toString(): string },
  decimals = 6
): string {
  const v = Number(raw.toString()) / 10 ** decimals;
  return v.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

export function formatDeadline(deadline: { toNumber(): number }): string {
  const d = new Date(deadline.toNumber() * 1000);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
