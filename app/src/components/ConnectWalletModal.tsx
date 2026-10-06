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
import { WalletReadyState } from "@solana/wallet-adapter-base";

/**
 * Drop-in replacement for the wallet-adapter's WalletModalProvider.
 * It keeps the exact same modal context (so WalletMultiButton and any
 * useWalletModal() consumer work unchanged) but renders Mohar's own
 * wallet selector instead of the stock modal. The stock modal is pointed
 * at a nonexistent portal container so it never renders; connection
 * behavior (select -> autoConnect) is identical to the default.
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
  onChoose: (name: Wallet["adapter"]["name"]) => void;
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

function ConnectWalletModal() {
  const { visible, setVisible } = useWalletModal();
  const { wallets, select, wallet, connecting, connect } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  /**
   * Wallet the user picked in the selector, awaiting connection.
   * select() and connect() are separate adapter operations and connect()
   * closes over the selected wallet, so the connection is triggered from
   * the effect below once the provider has processed the selection —
   * never synchronously in the click handler.
   */
  const connectRequested = useRef<Wallet["adapter"]["name"] | null>(null);

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
    setVisible(false);
  }, [setVisible]);

  const choose = useCallback(
    (name: Wallet["adapter"]["name"]) => {
      // One user gesture: select, then immediately initiate the connection.
      // The effect below performs the actual connect() once the provider
      // has the new selection. The modal closes right away; the navbar
      // shows "Connecting ..." while the wallet popup is open.
      connectRequested.current = name;
      select(name);
      close();
    },
    [select, close]
  );

  // Fires the connection after a wallet is chosen. Runs even while the
  // modal is closed (hooks execute before the early return below).
  useEffect(() => {
    if (
      connectRequested.current &&
      wallet &&
      wallet.adapter.name === connectRequested.current &&
      !connecting &&
      !wallet.adapter.connected
    ) {
      connectRequested.current = null;
      connect().catch(() => {
        // Any failure must leave a clean idle state. The adapter unsets the
        // selection itself for errors raised during connect() (e.g. user
        // rejected in the wallet popup); for earlier failures (e.g. wallet
        // not installed -> WalletNotReadyError) we clear it here so the
        // navbar never gets stuck on a dead "Connect" state.
        select(null);
      });
    }
  }, [wallet, connecting, connect, select]);

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
        <h2 id="mohar-wallet-title" className="mohar-modal-title">
          Connect your wallet
        </h2>
        <p className="mohar-modal-sub">Choose a Solana wallet to continue.</p>
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
      </div>
    </div>,
    document.body
  );
}
