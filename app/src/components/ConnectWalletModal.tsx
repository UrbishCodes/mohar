import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import {
  useWalletModal,
  WalletModalProvider,
} from "@solana/wallet-adapter-react-ui";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";

/**
 * Drop-in replacement for the wallet-adapter's WalletModalProvider.
 * It keeps the exact same modal context (so useWalletModal() consumers work
 * unchanged) but renders Mohar's own wallet selector instead of the stock
 * modal. The stock modal is pointed at a nonexistent portal container so it
 * never renders.
 *
 * Connection lifecycle:
 *   select(name) -> connect() (immediately, via the effect below)
 * A selected-but-not-connected wallet is "pending" and can always be
 * changed or cancelled. Switching from a connected wallet disconnects the
 * old adapter first and waits for it to settle, so the old adapter's async
 * 'disconnect' event can never wipe the new selection.
 */
export function ConnectWalletModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WalletModalProvider container="#mohar-modal-suppressed">
      {children}
      <ConnectWalletModal />
    </WalletModalProvider>
  );
}

/** Official download pages, opened only via an explicit user click. */
const INSTALL_URLS: Record<string, string> = {
  Phantom: "https://phantom.com/download",
  Solflare: "https://solflare.com/download",
};

function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mohar-wallet-chevron"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function WalletRow({
  wallet,
  onChoose,
}: {
  wallet: Wallet;
  onChoose: (name: WalletName) => void;
}) {
  const installed = wallet.readyState === WalletReadyState.Installed;
  return (
    <li>
      <button
        type="button"
        className="mohar-wallet-row"
        onClick={() => onChoose(wallet.adapter.name)}
      >
        <span className="mohar-wallet-icon">
          <img src={wallet.adapter.icon} alt="" aria-hidden="true" />
        </span>
        <span className="mohar-wallet-name">{wallet.adapter.name}</span>
        {installed && <span className="mohar-wallet-badge">Detected</span>}
        <ChevronIcon />
      </button>
    </li>
  );
}

function GuidanceView({
  name,
  onBack,
}: {
  name: string;
  onBack: () => void;
}) {
  const installUrl = INSTALL_URLS[name];
  return (
    <div className="mohar-guidance">
      <h2 id="mohar-wallet-title" className="mohar-modal-title">
        {name} isn&rsquo;t available
      </h2>
      <p className="mohar-modal-sub">
        Install or unlock {name}, then try again.
      </p>
      <div className="mohar-guidance-actions">
        {installUrl && (
          <a
            className="mohar-btn-primary"
            href={installUrl}
            target="_blank"
            rel="noreferrer"
          >
            Install {name}
          </a>
        )}
        <button
          type="button"
          className="mohar-btn-ghost"
          onClick={onBack}
        >
          Try another wallet
        </button>
      </div>
      <details className="mohar-trouble">
        <summary>Having trouble connecting?</summary>
        <ol>
          <li>Install the wallet extension</li>
          <li>Unlock your wallet</li>
          <li>Return to this page</li>
          <li>Try connecting again</li>
        </ol>
      </details>
    </div>
  );
}

function ConnectWalletModal() {
  const { visible, setVisible } = useWalletModal();
  const {
    wallets,
    select,
    wallet,
    connected,
    disconnect,
  } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const [guidanceFor, setGuidanceFor] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  /**
   * Monotonic id for connection attempts. Bumped whenever the user abandons
   * or replaces a pending attempt; the connect effect checks it on
   * settlement so a stale attempt can never corrupt the current state.
   */
  const attemptRef = useRef(0);
  /**
   * The attempt that currently owns the UI state. Set when a connection is
   * fired, cleared when it settles or is explicitly abandoned. Used by the
   * repair effect below.
   */
  const liveAttempt = useRef<{
    name: WalletName;
    id: number;
    repaired: boolean;
  } | null>(null);
  /**
   * Wallet the user picked, awaiting connection. select() and connect() are
   * separate adapter operations and connect() closes over the selected
   * wallet, so the connection is triggered from the effect below once the
   * provider has processed the selection — never synchronously in the click
   * handler.
   */
  const connectRequested = useRef<{ name: WalletName; id: number } | null>(null);

  /** A wallet is "pending" while selected but not yet connected. */
  const pendingWallet = wallet && !connected ? wallet : null;

  // Same grouping as the stock modal: installed first, the rest behind
  // "More options". If nothing is installed, show everything.
  const [installed, others] = useMemo(() => {
    const yes: Wallet[] = [];
    const no: Wallet[] = [];
    for (const w of wallets) {
      if (w.readyState === WalletReadyState.Installed) yes.push(w);
      else no.push(w);
    }
    return yes.length ? [yes, no] : [no, []];
  }, [wallets]);

  const close = useCallback(() => {
    setExpanded(false);
    setGuidanceFor(null);
    setShowList(true);
    setVisible(false);
  }, [setVisible]);

  /** Abandon a pending attempt; its settlement is discarded via attemptRef. */
  const abandonPending = useCallback(() => {
    attemptRef.current += 1;
    connectRequested.current = null;
    liveAttempt.current = null;
    select(null);
  }, [select]);

  const cancelPending = useCallback(() => {
    abandonPending();
    close();
  }, [abandonPending, close]);

  const choose = useCallback(
    async (name: WalletName) => {
      if (name === wallet?.adapter.name) {
        close();
        return;
      }
      const target = wallets.find((w) => w.adapter.name === name);
      if (
        !target ||
        !(
          target.readyState === WalletReadyState.Installed ||
          target.readyState === WalletReadyState.Loadable
        )
      ) {
        // Wallet not detected: show guidance instead of a doomed attempt.
        setGuidanceFor(name);
        return;
      }
      // Abandon any in-flight attempt before starting a new one.
      attemptRef.current += 1;
      liveAttempt.current = null;
      if (wallet) {
        // Safe switch: disconnect the current adapter (connected or still
        // connecting) and WAIT for it to settle. This guarantees its async
        // 'disconnect' event is processed before the new selection, so it
        // can never wipe it.
        try {
          await disconnect();
        } catch {
          /* proceed anyway */
        }
      }
      const id = attemptRef.current;
      connectRequested.current = { name, id };
      select(name);
      close();
    },
    [wallets, wallet, disconnect, select, close]
  );

  // Fires the connection after a wallet is chosen. Runs even while the
  // modal is closed (hooks execute before the early return below).
  //
  // The adapter is connected DIRECTLY (not via the provider's connect()):
  // the provider's global isConnectingRef would otherwise block a new
  // attempt while an abandoned one is still settling, and its
  // onConnectError would wipe the new selection when the abandoned attempt
  // fails. The adapter's own 'connect'/'error' events still drive the
  // provider's connected/publicKey state, and failures are handled below.
  useEffect(() => {
    const req = connectRequested.current;
    if (
      !req ||
      !wallet ||
      wallet.adapter.name !== req.name ||
      wallet.adapter.connected
    ) {
      return;
    }
    connectRequested.current = null;
    const { id, name } = req;
    const adapter = wallet.adapter;
    liveAttempt.current = { name, id, repaired: false };
    adapter
      .connect()
      .then(() => {
        if (attemptRef.current !== id) {
          // Superseded (user changed/cancelled mid-flight): release the
          // session this attempt created so nothing lingers connected.
          adapter.disconnect().catch(() => {});
        }
        if (liveAttempt.current?.id === id) liveAttempt.current = null;
      })
      .catch(() => {
        if (attemptRef.current === id) {
          liveAttempt.current = null;
          select(null);
        }
        // Superseded: the newer attempt owns the state; do nothing.
      });
  }, [wallet, select]);

  // Safety net: if a live attempt exists but the wallet got unselected
  // (a stale provider event wiped it), restore the selection and re-arm
  // the connection. This covers effect-order flips where the provider's
  // autoConnect (not our effect) ran the real connection attempt.
  useEffect(() => {
    const live = liveAttempt.current;
    if (live && !live.repaired && !wallet && !connected) {
      live.repaired = true;
      connectRequested.current = { name: live.name, id: live.id };
      select(live.name);
    }
  }, [wallet, connected, select]);

  // Reset the modal view whenever it opens.
  useEffect(() => {
    if (visible) {
      setGuidanceFor(null);
      setShowList(!(wallet && !connected));
    }
    // Intentionally only on open; wallet/connected are read at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      cardRef.current
        ?.querySelector<HTMLButtonElement>(".mohar-wallet-row")
        ?.focus();
    }, 60);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab" && cardRef.current) {
        const items = Array.from(
          cardRef.current.querySelectorAll<HTMLButtonElement>("button")
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      prevFocus.current?.focus?.();
    };
  }, [visible, close]);

  if (!visible) return null;

  const shown = expanded ? [...installed, ...others] : installed;

  return createPortal(
    <div className="mohar-modal-overlay" onClick={close}>
      <div
        ref={cardRef}
        className="mohar-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mohar-wallet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="mohar-modal-close"
          onClick={close}
          aria-label="Close wallet selector"
        >
          <XIcon />
        </button>

        {guidanceFor ? (
          <GuidanceView name={guidanceFor} onBack={() => setGuidanceFor(null)} />
        ) : !showList && pendingWallet ? (
          <div className="mohar-pending">
            <h2 id="mohar-wallet-title" className="mohar-modal-title">
              Connecting to {pendingWallet.adapter.name}&hellip;
            </h2>
            <p className="mohar-modal-sub">
              Approve the connection in your {pendingWallet.adapter.name}{" "}
              wallet.
            </p>
            <div className="mohar-pending-actions">
              <button
                type="button"
                className="mohar-btn-primary"
                onClick={() => setShowList(true)}
              >
                Change wallet
              </button>
              <button
                type="button"
                className="mohar-btn-ghost"
                onClick={cancelPending}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 id="mohar-wallet-title" className="mohar-modal-title">
              Connect your wallet
            </h2>
            <p className="mohar-modal-sub">
              Choose a Solana wallet to continue.
            </p>
            {shown.length > 0 ? (
              <ul className="mohar-wallet-list">
                {shown.map((w) => (
                  <WalletRow
                    key={w.adapter.name}
                    wallet={w}
                    onChoose={choose}
                  />
                ))}
              </ul>
            ) : (
              <p className="mohar-modal-empty">
                No wallets found. Install a Solana wallet to continue.
              </p>
            )}
            {others.length > 0 && !expanded && (
              <button
                type="button"
                className="mohar-modal-more"
                onClick={() => setExpanded(true)}
              >
                More options
              </button>
            )}
            {pendingWallet && (
              <button
                type="button"
                className="mohar-btn-ghost"
                onClick={cancelPending}
              >
                Cancel connection
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
