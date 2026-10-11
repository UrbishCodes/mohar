export type ClusterName = "devnet";

// Direct Helius endpoint. The API key is exposed in the shipped bundle, but
// the Helius dashboard restricts this key to requests from the deployed
// origin (mohar-beta.vercel.app). Abuse from outside that origin is rejected
// by Helius before it reaches the RPC. Rotate the key post-submission.
const HELIUS_DEVNET =
  "https://devnet.helius-rpc.com/?api-key=a59040a6-3a77-4f44-b440-3bb05ca599ba";

// Local dev uses public devnet to avoid the domain restriction blocking
// localhost. Production uses Helius.
const DEVNET_ENDPOINT = import.meta.env.DEV
  ? "https://api.devnet.solana.com"
  : HELIUS_DEVNET;

export const CLUSTERS: Record<ClusterName, { label: string; endpoint: string }> = {
  devnet: { label: "Devnet", endpoint: DEVNET_ENDPOINT },
};

export const PROGRAM_ID = "Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ";

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
  /* only one cluster */
}