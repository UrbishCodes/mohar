import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { View } from "./TopBar";
import { hasAcceptedLegal, markLegalAccepted } from "../lib/legal";

/**
 * One-time consent gate: the first time a wallet connects on this browser,
 * the user must accept the Terms + Privacy Policy (or disconnect).
 * Acceptance is remembered in localStorage afterwards.
 */
export function ConsentModal({
  go,
  view,
}: {
  go: (v: View) => void;
  view: View;
}) {
  const { connected, disconnect } = useWallet();
  const [accepted, setAccepted] = useState<boolean>(() => hasAcceptedLegal());

  // Hide while the user is reading the legal pages; it returns afterwards
  // if they still haven't accepted.
  const readingLegal = view.name === "privacy" || view.name === "terms";
  const visible = connected && !accepted && !readingLegal;

  if (!visible) return null;

  const accept = () => {
    markLegalAccepted();
    setAccepted(true);
  };

  const decline = () => {
    void disconnect();
  };

  return (
    <div className="mohar-modal-overlay" role="dialog" aria-modal="true" aria-label="Terms acceptance">
      <div className="mohar-modal-card" style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Before you continue</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
          Mohar is a non-custodial escrow on Solana devnet. By connecting your
          wallet and using Mohar, you agree to our{" "}
          <button className="link" onClick={() => go({ name: "terms" })}>
            Terms of Service
          </button>{" "}
          and{" "}
          <button className="link" onClick={() => go({ name: "privacy" })}>
            Privacy Policy
          </button>
          . We never hold your keys or funds — every transaction is signed in
          your own wallet.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button className="btn btn-primary" onClick={accept} style={{ flex: 1 }}>
            I agree
          </button>
          <button className="btn btn-ghost" onClick={decline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
