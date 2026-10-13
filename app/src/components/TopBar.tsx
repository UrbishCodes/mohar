import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "./WalletButton";
import { MoharMark } from "./MoharMark";
import type { ClusterName } from "../lib/config";
import type { Theme, ThemeMode } from "../lib/theme";

export type View =
  | { name: "landing" }
  | { name: "dashboard" }
  | { name: "create" }
  | { name: "detail"; escrow: string }
  | { name: "privacy" }
  | { name: "terms" }
  | { name: "profile" }
  | { name: "guide" };

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
  theme,
}: {
  view: View;
  go: (v: View) => void;
  cluster: ClusterName;
  theme: Theme;
}) {
  const { connected } = useWallet();
  const { mode, setMode } = theme;
  const [menuOpen, setMenuOpen] = useState(false);

  const cycleTheme = () => setMode(mode === "dark" ? "light" : "dark");
  const nav = (v: View) => {
    setMenuOpen(false);
    go(v);
  };

  const navBtn = (v: View, label: string, opts?: { primary?: boolean }) => (
    <button
      key={label}
      className={`${opts?.primary ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}${
        !opts?.primary && view.name === v.name ? " active" : ""
      }`}
      onClick={() => nav(v)}
      aria-current={!opts?.primary && view.name === v.name ? "page" : undefined}
    >
      {label}
    </button>
  );

  return (
    <header className="topbar">
      <div className="topbar-in">
        <button
          className="brand"
          onClick={() => nav({ name: "landing" })}
          aria-label="Mohar home"
        >
          <MoharMark size={30} />
          <span className="brand-name">Mohar</span>
          {cluster === "devnet" && <span className="netdot">Devnet</span>}
        </button>

        <nav className="topbar-actions hide-sm" aria-label="Primary">
          {navBtn({ name: "landing" }, "About")}
          {navBtn({ name: "guide" }, "How it works")}
          {navBtn({ name: "profile" }, "Profile")}
          {connected && navBtn({ name: "dashboard" }, "Dashboard")}
          {connected && navBtn({ name: "create" }, "+ New escrow", { primary: true })}
        </nav>

        <div className="topbar-actions">
          <button
            className="theme-toggle hide-md"
            onClick={cycleTheme}
            aria-label={`Theme: ${mode}. Activate to change.`}
            title={`Theme: ${mode}`}
          >
            <ThemeIcon mode={mode} />
          </button>
          <WalletButton />
          <button
            className="btn btn-ghost btn-sm menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            ☰
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="menu-sheet"
          onClick={(e) => e.target === e.currentTarget && setMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="menu-panel">
            {navBtn({ name: "landing" }, "About")}
            {navBtn({ name: "guide" }, "How it works")}
            {navBtn({ name: "profile" }, "Profile")}
            {connected && navBtn({ name: "dashboard" }, "Dashboard")}
            {connected &&
              navBtn({ name: "create" }, "+ New escrow", { primary: true })}
            <div className="menu-row">
              <span>Theme: {mode}</span>
              <button
                className="theme-toggle"
                onClick={cycleTheme}
                aria-label="Toggle theme"
              >
                <ThemeIcon mode={mode} />
              </button>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setMenuOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
