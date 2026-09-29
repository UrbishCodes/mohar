import type { View } from "../components/TopBar";

export default function Landing({ go }: { go: (v: View) => void }) {
  return (
    <div className="page">
      <section className="hero">
        <h1>
          Mohar <span className="gold">मोहर</span>
        </h1>
        <p className="tagline">SEALED. SETTLED. PAID.</p>
        <p className="lede">
          Escrow for Nepali freelancers working with international clients.
          The client locks USDC in a smart-contract vault — the freelancer
          delivers, the client releases, and nobody gets ghosted. If the
          client disappears, the freelancer claims after the deadline.
        </p>
        <div className="hero-cta">
          <button className="btn btn-primary" onClick={() => go({ name: "create" })}>
            Start an escrow
          </button>
          <button className="btn" onClick={() => go({ name: "dashboard" })}>
            View dashboard
          </button>
        </div>
      </section>

      <div className="seal-divider">
        <div className="brand-mark">मो</div>
      </div>

      <h2 className="section-title">How it works</h2>
      <p className="section-sub">Five steps. Zero trust issues.</p>
      <div className="steps">
        <div className="card step-card">
          <div className="num">1</div>
          <h3>Client locks USDC</h3>
          <p>The client funds a vault controlled by the Mohar program. The money is sealed — neither side can touch it alone.</p>
        </div>
        <div className="card step-card">
          <div className="num">2</div>
          <h3>Freelancer delivers</h3>
          <p>Work gets done off-chain as usual. The freelancer marks the escrow delivered when the work ships.</p>
        </div>
        <div className="card step-card">
          <div className="num">3</div>
          <h3>Client releases</h3>
          <p>Happy with the work? One click releases the full amount to the freelancer. No invoices lost in DMs.</p>
        </div>
        <div className="card step-card">
          <div className="num">4</div>
          <h3>Ghost protection</h3>
          <p>If the client vanishes after the deadline, the freelancer claims the funds directly. No more "I'll pay next week".</p>
        </div>
        <div className="card step-card">
          <div className="num">5</div>
          <h3>Fair disputes</h3>
          <p>Either side can raise a dispute. A mutually-agreed arbiter reviews and releases or refunds.</p>
        </div>
      </div>

      <h2 className="section-title">Why Mohar</h2>
      <p className="section-sub">Built for how freelancing actually works.</p>
      <div className="steps">
        <div className="card step-card">
          <div className="num">✓</div>
          <h3>No platform cut</h3>
          <p>Just Solana network fees — fractions of a cent. Your rate is your rate.</p>
        </div>
        <div className="card step-card">
          <div className="num">✓</div>
          <h3>USDC settlement</h3>
          <p>Stable value, no volatility games between invoice and payday.</p>
        </div>
        <div className="card step-card">
          <div className="num">✓</div>
          <h3>On-chain proof</h3>
          <p>Every lock, delivery, release and dispute is a permanent record.</p>
        </div>
      </div>

      <div className="seal-divider">
        <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
          Mohar is the seal on every deal.
        </p>
      </div>
    </div>
  );
}
