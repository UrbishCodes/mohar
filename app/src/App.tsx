import { useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { ConnectWalletModalProvider } from "./components/ConnectWalletModal";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { CLUSTERS, getCluster, type ClusterName } from "./lib/config";
import { useTheme } from "./lib/theme";
import { TopBar, type View } from "./components/TopBar";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import CreateEscrow from "./pages/CreateEscrow";
import EscrowDetail from "./pages/EscrowDetail";

import "@solana/wallet-adapter-react-ui/styles.css";

export default function App() {
  const [view, setView] = useState<View>({ name: "landing" });
  const [cluster, setClusterState] = useState<ClusterName>(() => getCluster());
  const theme = useTheme();
  const endpoint = CLUSTERS[cluster].endpoint;

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
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
