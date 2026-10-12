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
import { Footer } from "./components/Footer";
import { ConsentModal } from "./components/ConsentModal";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { supabase } from "./lib/supabase";
import { viewToPath, pathToView } from "./lib/router";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import CreateEscrow from "./pages/CreateEscrow";
import EscrowDetail from "./pages/EscrowDetail";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Guide from "./pages/Guide";
import ProfilePage from "./pages/Profile";

import "@solana/wallet-adapter-react-ui/styles.css";

export default function App() {
  // Scrub auth material from the URL after sign-in. With the PKCE flow the
  // magic link carries only a single-use `code` (no session tokens ever
  // touch the URL), but the code is still scrubbed once exchanged so a
  // copied URL contains nothing sensitive. The `access_token` fragment
  // branch is a safety net for any legacy implicit-flow link.
  useEffect(() => {
    if (!supabase) return;
    const params = new URLSearchParams(window.location.search);
    const hasCode = params.has("code");
    const hasFragmentTokens = window.location.hash.includes("access_token");
    if (!hasCode && !hasFragmentTokens) return;
    let unsub: (() => void) | null = null;
    const clear = () => {
      window.history.replaceState(null, "", window.location.pathname);
      unsub?.();
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        clear();
      } else {
        const { data: sub } = supabase!.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN") clear();
        });
        unsub = () => sub.subscription.unsubscribe();
      }
    });
    return () => unsub?.();
  }, []);

  const [view, setView] = useState<View>(() =>
    pathToView(window.location.pathname)
  );

  // URL-driven navigation: every view change pushes a history entry, so
  // browser back/forward (buttons, mouse shortcuts, Alt+arrows) work, and
  // escrow pages get shareable deep links.
  const go = useCallback((v: View) => {
    window.history.pushState(null, "", viewToPath(v));
    setView(v);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPop = () => setView(pathToView(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
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
          <ConfirmProvider>
          <TopBar
            view={view}
            go={go}
            cluster={cluster}
            onCluster={setClusterState}
            theme={theme}
          />
          {view.name === "landing" && <Landing go={go} theme={theme} />}
          {view.name === "dashboard" && <Dashboard go={go} />}
          {view.name === "create" && <CreateEscrow go={go} />}
          {view.name === "detail" && (
            <EscrowDetail escrowKey={view.escrow} go={go} />
          )}
          {view.name === "privacy" && <Privacy go={go} />}
          {view.name === "terms" && <Terms go={go} />}
          {view.name === "guide" && <Guide go={go} />}
          {view.name === "profile" && <ProfilePage go={go} />}
          <Footer go={go} />
          <ConsentModal go={go} view={view} />
          </ConfirmProvider>
        </ConnectWalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
