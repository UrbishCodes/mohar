import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { CLUSTERS, getCluster, setCluster, type ClusterName } from "../lib/config";

export type View =
  | { name: "landing" }
  | { name: "dashboard" }
  | { name: "create" }
  | { name: "detail"; escrow: string };

export function TopBar({
  view,
  go,
  cluster,
  onCluster,
}: {
  view: View;
  go: (v: View) => void;
  cluster: ClusterName;
  onCluster: (c: ClusterName) => void;
}) {
  const { connected } = useWallet();

  const switchCluster = (c: ClusterName) => {
    if (c !== cluster) {
      setCluster(c);
      onCluster(c);
    }
  };

  return (
    <header className="topbar">
      <div className="brand" onClick={() => go({ name: "landing" })}>
        <div className="brand-mark">मो</div>
        <div className="brand-name">
          Mohar<span className="nepali">मोहर</span>
        </div>
      </div>
      <div className="topbar-actions">
        {view.name !== "landing" && (
          <button className="btn btn-ghost" onClick={() => go({ name: "landing" })}>
            About
          </button>
        )}
        {connected && view.name !== "dashboard" && (
          <button className="btn btn-ghost" onClick={() => go({ name: "dashboard" })}>
            Dashboard
          </button>
        )}
        {connected && view.name !== "create" && (
          <button className="btn btn-primary" onClick={() => go({ name: "create" })}>
            + New escrow
          </button>
        )}
        <div className="cluster-toggle">
          {(Object.keys(CLUSTERS) as ClusterName[]).map((c) => (
            <button
              key={c}
              className={cluster === c ? "active" : ""}
              onClick={() => switchCluster(c)}
            >
              {CLUSTERS[c].label}
            </button>
          ))}
        </div>
        <WalletMultiButton />
      </div>
    </header>
  );
}

// Re-export so pages can read the saved cluster on load.
export { getCluster };
