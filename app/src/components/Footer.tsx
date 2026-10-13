import type { View } from "./TopBar";
import { CLUSTERS, type ClusterName } from "../lib/config";

export function Footer({
  go,
  cluster,
  onCluster,
}: {
  go: (v: View) => void;
  cluster: ClusterName;
  onCluster: (c: ClusterName) => void;
}) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="footer-brand">Mohar — Sealed. Settled. Paid.</span>
        <nav className="footer-links" aria-label="Legal">
          <button className="link" onClick={() => go({ name: "profile" })}>
            Profile
          </button>
          <button className="link" onClick={() => go({ name: "privacy" })}>
            Privacy Policy
          </button>
          <button className="link" onClick={() => go({ name: "terms" })}>
            Terms of Service
          </button>
          <button className="link" onClick={() => go({ name: "guide" })}>
            How to use Mohar
          </button>
          <a
            className="link"
            href="https://github.com/UrbishCodes/mohar"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            className="link"
            href="https://github.com/UrbishCodes/mohar/issues/new"
            target="_blank"
            rel="noreferrer"
          >
            Report a bug
          </a>
        </nav>
        <div
          className="footer-net"
          role="group"
          aria-label="Solana network"
        >
          {(Object.keys(CLUSTERS) as ClusterName[]).map((c) => (
            <button
              key={c}
              aria-pressed={cluster === c}
              onClick={() => cluster !== c && onCluster(c)}
            >
              {CLUSTERS[c].label}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
