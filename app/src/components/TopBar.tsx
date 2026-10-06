import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { CLUSTERS, setCluster, type ClusterName } from "../lib/config";
import { logoFor, type Theme, type ThemeMode } from "../lib/theme";

export type View =
  | { name: "landing" }
  | { name: "dashboard" }
  | { name: "create" }
  | { name: "detail"; escrow: string };

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (mode === "dark")
    return (
      <svg {...common}>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

export function TopBar({
  view,
  go,
  cluster,
  onCluster,
  theme,
}: {
  view: View;
  go: (v: View) => void;
  cluster: ClusterName;
  onCluster: (c: ClusterName) => void;
  theme: Theme;
}) {
  const { connected } = useWallet();
  const { mode, setMode, resolved } = theme;

  const switchCluster = (c: ClusterName) => {
    if (c !== cluster) {
      setCluster(c);
      onCluster(c);
    }
  };

  const cycleTheme = () => setMode(mode === "dark" ? "light" : "dark");

  return (
    <header className="topbar">
      <div className="brand" onClick={() => go({ name: "landing" })}>
        <img
          className="brand-mark"
          src={logoFor(resolved)}
          alt=""
          aria-hidden="true"
          width={44}
          height={44}
        />
        <div className="brand-name">Mohar</div>
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
        <button
          className="theme-toggle"
          onClick={cycleTheme}
          aria-label={`Theme: ${mode}. Activate to change.`}
          title={`Theme: ${mode}`}
        >
          <ThemeIcon mode={mode} />
        </button>
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
