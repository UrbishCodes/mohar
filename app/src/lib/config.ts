export type ClusterName = "devnet";

export const CLUSTERS: Record<ClusterName, { label: string; endpoint: string }> = {
  devnet: {
    label: "Devnet",
    endpoint: "https://devnet.helius-rpc.com/?api-key=a59040a6-3a77-4f44-b440-3bb05ca599ba",
  },
};

export const PROGRAM_ID = "Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ";

// Circle's devnet USDC. Override via localStorage "mohar:mint" if needed.
export const DEFAULT_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export function getMintAddress(): string {
  try {
    const saved = localStorage.getItem("mohar:mint");
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_USDC_MINT;
}

export function getCluster(): ClusterName {
  return "devnet";
}

export function setCluster(_c: ClusterName) {
  /* only one cluster: no-op */
}