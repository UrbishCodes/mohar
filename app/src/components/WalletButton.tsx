import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

/**
 * Navbar wallet button with three honest states:
 *   no wallet        -> "Connect Wallet" (opens the selector)
 *   pending          -> "Connecting to {name}…" (opens the selector, which
 *                       offers Change wallet / Cancel while pending)
 *   connected        -> truncated address + dropdown (Copy address,
 *                       Change wallet, Disconnect)
 */
export function WalletButton() {
  const { wallet, connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // A state change (connect/disconnect/switch) invalidates the open menu.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect`r`n  setMenuOpen(false);
  }, [connected, wallet]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  if (!wallet) {
    return (
      <button
        type="button"
        className="mohar-wallet-btn"
        onClick={() => setVisible(true)}
      >
        Connect Wallet
      </button>
    );
  }

  if (!connected) {
    return (
      <button
        type="button"
        className="mohar-wallet-btn is-pending"
        onClick={() => setVisible(true)}
        title="Change wallet"
        aria-label={`Connecting to ${wallet.adapter.name}. Activate to change wallet.`}
      >
        <span className="mohar-wallet-btn-icon" aria-hidden="true">
          <img src={wallet.adapter.icon} alt="" />
        </span>
        Connecting to {wallet.adapter.name}&hellip;
      </button>
    );
  }

  const address = publicKey ? publicKey.toBase58() : "";
  const short = address
    ? `${address.slice(0, 4)}..${address.slice(-4)}`
    : wallet.adapter.name;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; ignore */
    }
  };

  return (
    <div className="mohar-wallet-wrap" ref={wrapRef}>
      <button
        type="button"
        className="mohar-wallet-btn is-connected"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="mohar-wallet-btn-icon" aria-hidden="true">
          <img src={wallet.adapter.icon} alt="" />
        </span>
        {short}
      </button>
      {menuOpen && (
        <ul className="mohar-wallet-menu" role="menu">
          <li role="none">
            <button type="button" role="menuitem" onClick={copyAddress}>
              {copied ? "Copied!" : "Copy address"}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setVisible(true);
              }}
            >
              Change wallet
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                disconnect();
              }}
            >
              Disconnect
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
