export type ClusterName = "devnet";

// Helius API key comes from the VITE_HELIUS_API_KEY environment variable
// (set in Vercel). It is exposed in the shipped bundle by nature of being a
// client-side RPC key — the Helius dashboard restricts it to requests from
// the deployed origins, and abuse from outside those origins is rejected by
// Helius. Rotate the key in the Helius dashboard if it is ever exposed.
const HELIUS_KEY = import.meta.env.VITE_HELIUS_API_KEY as string | undefined;
const HELIUS_DEVNET = HELIUS_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : "https://api.devnet.solana.com"; // fallback: public devnet

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