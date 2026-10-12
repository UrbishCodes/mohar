import type { View } from "./TopBar";

export function Footer({ go }: { go: (v: View) => void }) {
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
            href="https://github.com/UrbishCodes"
            target="_blank"
            rel="noreferrer"
          >
            Contact
          </a>
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
      </div>
    </footer>
  );
}
