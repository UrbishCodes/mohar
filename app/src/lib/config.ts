import { clusterApiUrl } from "@solana/web3.js";

export type ClusterName = "devnet" | "localnet";

export const CLUSTERS: Record<ClusterName, { label: string; endpoint: string }> = {
  devnet: { label: "Devnet", endpoint: clusterApiUrl("devnet") },
  localnet: { label: "Localnet", endpoint: "http://127.0.0.1:8899" },
};

export const PROGRAM_ID = "Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ";

// Circle's devnet USDC. Override here (or via localStorage "mohar:mint")
// when testing with a different mint.
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
  try {
    const saved = localStorage.getItem("mohar:cluster");
    if (saved === "localnet" || saved === "devnet") return saved;
  } catch {
    /* ignore */
  }
  return "devnet";
}

export function setCluster(c: ClusterName) {
  try {
    localStorage.setItem("mohar:cluster", c);
  } catch {
    /* ignore */
  }
}
