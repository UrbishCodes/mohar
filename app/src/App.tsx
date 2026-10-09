import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { ConnectWalletModalProvider } from "./components/ConnectWalletModal";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { CLUSTERS, getCluster, type ClusterName } from "./lib/config";
import { useTheme } from "./lib/theme";
import { TopBar, type View } from "./components/TopBar";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import CreateEscrow from "./pages/CreateEscrow";
import EscrowDetail from "./pages/EscrowDetail";

import "@solana/wallet-adapter-react-ui/styles.css";

export default function App() {
  const [view, setView] = useState<View>(() => {
    try {
      const saved = sessionStorage.getItem("mohar:view");
      if (saved) return JSON.parse(saved) as View;
    } catch {
      /* ignore */
    }
    return { name: "landing" };
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("mohar:view", JSON.stringify(view));
    } catch {
      /* ignore */
    }
  }, [view]);
  const [cluster, setClusterState] = useState<ClusterName>(() => getCluster());
  const theme = useTheme();
  const endpoint = CLUSTERS[cluster].endpoint;

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  /**
   * Never let the wallet-adapter's default error handler run: on
   * WalletNotReadyError it calls window.open(adapter.url, '_blank'),
   * which opens a surprise wallet-website tab. Log instead; the app's
   * own state machine already resets to a clean idle state.
   */
  const handleWalletError = useCallback((error: Error) => {
    console.error("[mohar] wallet error:", error);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect
        onError={handleWalletError}
      >
        <ConnectWalletModalProvider>
          <TopBar
            view={view}
            go={setView}
            cluster={cluster}
            onCluster={setClusterState}
            theme={theme}
          />
          {view.name === "landing" && <Landing go={setView} theme={theme} />}
          {view.name === "dashboard" && <Dashboard go={setView} />}
          {view.name === "create" && <CreateEscrow go={setView} />}
          {view.name === "detail" && (
            <EscrowDetail escrowKey={view.escrow} go={setView} />
          )}
        </ConnectWalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
