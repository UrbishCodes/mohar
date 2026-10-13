import type { View } from "../components/TopBar";
import { RouteTracker, StatusPill, MiniRoute, Chip } from "../components/ui";
import { PROGRAM_ID } from "../lib/config";
import { shortAddr } from "../lib/format";

/** Landing page — design board v2: headline, route, roles, facts, guide, FAQ. */
export default function Landing({ go }: { go: (v: View) => void }) {
  return (
    <div className="page">
      <div className="lp">
        {/* hero */}
        <div className="lp-hero">
          <div>
            <div className="eyebrow">Escrow for Nepali freelancers · मोहर</div>
            <h1>
              <span>Sealed.</span>
              <span>Settled.</span>
              <span className="d">Paid.</span>
            </h1>
            <p className="lede">
              The client locks USDC in a vault. You deliver. The money moves
              when the deal does. No custodian, no platform cut, no
              &ldquo;I&rsquo;ll pay you next week&rdquo;.
            </p>
            <div className="cta">
              <button
                className="btn btn-primary btn-lg"
                onClick={() => go({ name: "create" })}
              >
                Start an escrow
              </button>
              <button
                className="btn btn-lg"
                onClick={() => go({ name: "guide" })}
              >
                See how a deal moves
              </button>
            </div>
            <div className="honest">
              <span>Live on Solana devnet, test USDC only</span>
              <span>Manual security review, not an audit</span>
              <a
                href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Program {shortAddr(PROGRAM_ID)} ↗
              </a>
            </div>
          </div>
          <div className="lp-vis">
            <article className="card ec" aria-label="Example escrow">
              <div className="ec-top">
                <div className="amt">
                  500.00<small>USDC</small>
                </div>
                <StatusPill status="Delivered" />
              </div>
              <div className="ec-next">
                The freelancer marked this delivered. Check the work, then
                release payment.
              </div>
              <MiniRoute status="Delivered" />
              <div className="ec-meta">
                <span className="chips">
                  <Chip move>Your move</Chip>
                  <Chip>Client</Chip>
                </span>
                <span className="addr">to 7Hq3…k2Fp</span>
              </div>
              <div className="ec-foot">
                <span className="dl">Due in 3 days</span>
              </div>
            </article>
          </div>
        </div>

        {/* the route */}
        <div className="lp-sec">
          <div className="eyebrow">The path of a deal</div>
          <h2>Every step is a program instruction</h2>
          <p className="note" style={{ maxWidth: "60ch", marginBottom: 20 }}>
            Funds sit in a vault the program controls. Neither side can move
            them outside these paths.
          </p>
          <div className="card">
            <RouteTracker status="Delivered" />
          </div>
        </div>

        {/* roles */}
        <div className="lp-sec">
          <div className="eyebrow">Choose your role</div>
          <h2>Who are you in this deal?</h2>
          <div className="roles">
            <div className="role">
              <h3>Client</h3>
              <p>You pay an international freelancer.</p>
              <ul>
                <li>Lock USDC for the job</li>
                <li>Release when you are happy</li>
                <li>Refund before delivery</li>
              </ul>
            </div>
            <div className="role">
              <h3>Freelancer</h3>
              <p>You do the work and want to get paid.</p>
              <ul>
                <li>See the funds locked first</li>
                <li>Mark the work delivered</li>
                <li>Claim if the client goes silent</li>
              </ul>
            </div>
            <div className="role">
              <h3>Arbiter</h3>
              <p>Both sides trust you to settle a disagreement.</p>
              <ul>
                <li>Named on the escrow up front</li>
                <li>Acts only if a dispute is raised</li>
                <li>Pays out or refunds</li>
              </ul>
            </div>
          </div>
        </div>

        {/* facts */}
        <div className="lp-sec">
          <div className="eyebrow">Facts</div>
          <h2>What is live, and what is not</h2>
          <div className="facts">
            <div>
              <span>Network</span>
              <b>Solana devnet</b>
            </div>
            <div>
              <span>Token</span>
              <b>USDC, 6 decimals</b>
            </div>
            <div>
              <span>Platform fee</span>
              <b>None</b>
            </div>
            <div>
              <span>Tests</span>
              <b>15 scenarios</b>
            </div>
            <div>
              <span>Security</span>
              <b>Manual review, no audit</b>
            </div>
            <div>
              <span>Mainnet</span>
              <b>Not yet</b>
            </div>
          </div>
        </div>

        {/* start guide */}
        <div className="lp-sec">
          <div className="eyebrow">Try it in four steps</div>
          <h2>Test funds, then a full deal</h2>
          <div
            className="roles"
            style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}
          >
            <div className="role">
              <h3>1 · Wallet</h3>
              <p>Install Phantom or Solflare and switch it to Devnet.</p>
            </div>
            <div className="role">
              <h3>2 · Test funds</h3>
              <p>
                Get devnet SOL for fees and 10 devnet USDC from Circle&rsquo;s
                faucet.
              </p>
            </div>
            <div className="role">
              <h3>3 · Create</h3>
              <p>
                Lock 1 USDC for a second wallet. You can play both roles.
              </p>
            </div>
            <div className="role">
              <h3>4 · Settle</h3>
              <p>
                Mark delivered, release, then watch each step on the explorer.
              </p>
            </div>
          </div>
        </div>

        {/* faq */}
        <div className="lp-sec faq">
          <div className="eyebrow">Questions</div>
          <h2>What if something goes wrong?</h2>
          <details>
            <summary>What if the client disappears?</summary>
            <p>
              After the deadline the freelancer can claim the funds directly.
              No support ticket.
            </p>
          </details>
          <details>
            <summary>What if we disagree about the work?</summary>
            <p>
              Either side can raise a dispute. The arbiter you both named
              decides who gets the money.
            </p>
          </details>
          <details>
            <summary>Does Mohar take a cut?</summary>
            <p>No. You pay only Solana network fees, a fraction of a cent.</p>
          </details>
          <details>
            <summary>Is it safe to use with real money?</summary>
            <p>
              Not yet. It runs on devnet and has had a manual review, not an
              audit.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
