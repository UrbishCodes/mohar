import type { View } from "../components/TopBar";
import { logoFor, type Theme } from "../lib/theme";

export default function Landing({
  go,
  theme,
}: {
  go: (v: View) => void;
  theme: Theme;
}) {
  return (
    <div className="page">
      <section className="hero">
        <h1>Mohar</h1>
        <p className="tagline">SEALED. SETTLED. PAID.</p>
        <p className="lede">
          Escrow for Nepali freelancers working with international clients.
          The client funds a vault, the freelancer accepts and delivers, the
          client releases — and if anyone disappears, the deadline rules
          decide who gets paid.
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
        <img
          src={logoFor(theme.resolved)}
          alt=""
          aria-hidden="true"
          width={72}
          height={72}
        />
      </div>

      <h2 className="section-title">How it works</h2>
      <p className="section-sub">Five steps. Zero trust issues.</p>
      <div className="steps">
        <div className="card step-card">
          <div className="num">1</div>
          <h3>Client funds escrow</h3>
          <p>The client names a freelancer and an arbiter, sets an amount and a deadline, and locks the full amount in a vault controlled by the Mohar program.</p>
        </div>
        <div className="card step-card">
          <div className="num">2</div>
          <h3>Freelancer accepts</h3>
          <p>The freelancer accepts the job. The client can cancel and reclaim only before this point — once accepted, the funds move only by release, deadline claim, or arbiter decision.</p>
        </div>
        <div className="card step-card">
          <div className="num">3</div>
          <h3>Freelancer delivers</h3>
          <p>Work gets done off-chain as usual. The freelancer marks the escrow delivered when the work ships — a signal, not a verification.</p>
        </div>
        <div className="card step-card">
          <div className="num">4</div>
          <h3>Client releases</h3>
          <p>Happy with the work? One click releases the full amount to the freelancer. If the work isn't done, dispute <em>before</em> the deadline — that blocks the freelancer's claim and the arbiter decides. Otherwise, past the deadline: the freelancer claims on accepted jobs, or the client reclaims if never accepted.</p>
        </div>
        <div className="card step-card">
          <div className="num">5</div>
          <h3>Disputes, if needed</h3>
          <p>Either side can raise a dispute while the escrow is active. The named arbiter then decides: pay the freelancer or refund the client. Their call is final.</p>
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
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Mohar is the seal on every deal.
        </p>
      </div>
    </div>
  );
}
