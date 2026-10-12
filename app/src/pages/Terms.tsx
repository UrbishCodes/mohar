import type { View } from "../components/TopBar";

const UPGRADE_AUTHORITY = "9ybCYJAJiceZ7KeUTEo4a9spq4FRxpUSt8AbpbkozUeu";
const PROGRAM_ID = "Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ";

export default function Terms({ go }: { go: (v: View) => void }) {
  return (
    <div className="page">
      <div className="card legal">
        <button className="btn btn-ghost" onClick={() => go({ name: "landing" })}>
          ← Back
        </button>
        <h1>Terms of Service</h1>
        <p className="legal-updated">
          Effective date: October 12, 2026 · Last updated: October 12, 2026
        </p>

        <h2>1. Agreement</h2>
        <p>
          These Terms of Service ("Terms") govern your use of the Mohar web
          application and related materials (the "Service"), operated by
          Urbish Ghimire ("we", "our"). By connecting a wallet, creating a
          profile, or otherwise using the Service, you agree to these Terms
          and to our{" "}
          <button className="link" onClick={() => go({ name: "privacy" })}>
            Privacy Policy
          </button>
          , which is incorporated by reference. If you do not agree, do not
          use the Service.
        </p>

        <h2>2. What Mohar is, and what it is not</h2>
        <p>
          Mohar is software that helps a <strong>client</strong> lock tokens
          in an on-chain escrow for a <strong>freelancer</strong>, with an
          optional <strong>arbiter</strong> to decide disputes. The rules
          are enforced by a program on the Solana blockchain (the
          "Program"). The web app is an interface to that Program.
        </p>
        <p>Mohar is not:</p>
        <ul>
          <li>
            a bank, payment institution, money transmitter, exchange, broker,
            or custodian;
          </li>
          <li>a party to any contract between client and freelancer;</li>
          <li>a marketplace, employer, or agent of any user;</li>
          <li>a provider of legal, tax, financial, or investment advice;</li>
          <li>
            a dispute-resolution body. Arbiters are chosen by the users, are
            independent of us, and are not our agents.
          </li>
        </ul>
        <p>
          We do not hold your funds or your private keys. We cannot reverse
          transactions, recover lost wallets, or move funds out of an
          escrow.
        </p>

        <h2>3. Current status: devnet, beta</h2>
        <p>
          Mohar currently operates <strong>only on the Solana devnet</strong>{" "}
          test network, using test tokens that have no monetary value. The
          Service is a beta and a hackathon project. It may be changed,
          interrupted, or discontinued at any time. Devnet tokens have no
          monetary value — never treat test transactions as real.
        </p>

        <h2>4. Eligibility</h2>
        <p>You may use the Service only if you:</p>
        <ul>
          <li>are at least 13 years old;</li>
          <li>have the legal capacity to enter into binding agreements;</li>
          <li>
            are not subject to economic or trade sanctions, and are not
            located in a jurisdiction where use of the Service is
            prohibited;
          </li>
          <li>
            use the Service in compliance with the laws that apply to you,
            including laws on digital assets, taxes, and foreign exchange.
            You are responsible for finding out whether using
            blockchain-based services is lawful where you live.
          </li>
        </ul>

        <h2>5. How an escrow works</h2>
        <p>
          The Program works as follows. These rules are enforced on-chain;
          the web app only presents them.
        </p>
        <ol>
          <li>
            <strong>Create.</strong> The client names a freelancer and an
            arbiter, chooses a token amount and a deadline, and signs a
            transaction moving the full amount into a vault controlled by
            the Program. The escrow is then <strong>Funded</strong>.
          </li>
          <li>
            <strong>Accept.</strong> The freelancer accepts the job, moving
            the escrow to <strong>In Progress</strong>. The client may cancel
            and reclaim the full amount only while the escrow is still{" "}
            <strong>Funded</strong> — once accepted, the client can no longer
            cancel unilaterally.
          </li>
          <li>
            <strong>Deliver.</strong> The freelancer may mark the escrow{" "}
            <strong>Delivered</strong>. This is a signal only; Mohar does not
            check any work.
          </li>
          <li>
            <strong>Release.</strong> After delivery, the client may release
            the full amount to the freelancer.
          </li>
          <li>
            <strong>Claim after deadline.</strong> Once the deadline has
            passed, the freelancer may claim the full amount if the escrow
            is In Progress or Delivered —{" "}
            <strong>
              even if nothing was ever delivered — unless a dispute was
              raised first.
            </strong>{" "}
            If you are a client, raise a dispute before the deadline if the
            work is not done.
          </li>
          <li>
            <strong>Reclaim after deadline.</strong> If the freelancer never
            accepted the job and the deadline has passed, the client may
            reclaim the full amount.
          </li>
          <li>
            <strong>Dispute.</strong> While an escrow is Funded, In Progress,
            or Delivered, either party may raise a dispute. Only the named
            arbiter can then resolve it, sending the full amount to either
            the freelancer or the client. The arbiter's decision is final
            within the Program. <strong>The Program has no time limit for
            the arbiter to act — if the arbiter never acts, the funds may
            remain locked permanently.</strong>
          </li>
        </ol>
        <p>
          All-or-nothing payouts apply: the Program does not split amounts
          or release by milestone. Transactions are final once confirmed on
          the blockchain.
        </p>

        <h2>6. Your responsibilities and risks</h2>
        <p>You understand and accept that:</p>
        <ul>
          <li>
            <strong>Check every address and amount.</strong> Sending funds to
            a wrong address, naming the wrong arbiter, or choosing the wrong
            deadline can cause permanent loss. Mohar cannot fix this.
          </li>
          <li>
            <strong>Choose your arbiter carefully.</strong> The arbiter has
            the power to decide a dispute in either direction, and the
            Program does not check that the arbiter is independent of the
            client or freelancer. Mohar does not vet, supervise, or
            guarantee any arbiter.
          </li>
          <li>
            <strong>Smart contract risk.</strong> The Program has been
            reviewed and tested by its developer, but it has{" "}
            <strong>not</strong> been independently audited and may contain
            bugs. Software, blockchain, and wallet failures, network
            congestion, and attacks can cause loss of funds. Never lock
            funds you cannot afford to lose.
          </li>
          <li>
            <strong>Upgradeability.</strong> The deployed Program (
            <code>{PROGRAM_ID}</code>) may be upgraded by the holder of its
            upgrade authority (<code>{UPGRADE_AUTHORITY}</code>). An upgrade
            could change the Program's rules.
          </li>
          <li>
            <strong>Token risk.</strong> Escrows use the token you choose
            (currently USDC on devnet). Token issuers may freeze tokens;
            tokens may lose value. Mohar is not responsible.
          </li>
          <li>
            <strong>Your wallet is your responsibility.</strong> Your keys,
            seed phrase, devices, and wallet software are yours to protect.
          </li>
          <li>
            <strong>Your underlying agreement.</strong> Any agreement between
            client and freelancer about work, price, or deliverables exists
            outside Mohar. We do not verify deliveries or enforce contracts.
          </li>
          <li>
            <strong>Taxes</strong> on your transactions are your
            responsibility.
          </li>
          <li>
            <strong>Fees.</strong> Mohar currently charges no fee; you pay
            only network fees.
          </li>
        </ul>

        <h2>7. Accounts and profiles</h2>
        <p>
          You may create an optional Mohar profile linked to your wallet
          address: a verified email address (confirmed via a verification
          link — no passwords), a username you choose or generate, and your
          user type (student, freelancer, or business owner). Business users
          may add a business name and city/state; freelancers may describe
          the work they do. We do not collect real names.
        </p>
        <ul>
          <li>
            Provide accurate information and keep it current. You may edit
            or delete your profile at any time from the profile page.
          </li>
          <li>
            Usernames must not impersonate another person or business, and
            must not be offensive or infringe anyone's rights. We may rename
            or remove a violating username.
          </li>
          <li>
            You are responsible for all activity under your profile. Keep
            your email address current so we can reach you about your
            account.
          </li>
          <li>
            Mohar is non-custodial: every transaction is signed inside your
            own wallet. If you lose access to your wallet, we cannot recover
            your funds.
          </li>
        </ul>

        <h2>8. Acceptable use</h2>
        <ul>
          <li>Do not use Mohar for any unlawful purpose.</li>
          <li>
            Do not use it to facilitate fraud, money laundering, terrorist
            financing, sanctions evasion, or other crime.
          </li>
          <li>
            Do not deceive others — for example, by naming someone as
            freelancer or arbiter without their knowledge.
          </li>
          <li>
            Do not interfere with other users' escrows or with the operation
            of the app.
          </li>
          <li>Do not misrepresent your identity, business, or qualifications.</li>
          <li>
            Do not attempt to access other users' accounts, profiles, or
            data.
          </li>
        </ul>

        <h2>9. Marketing communications</h2>
        <p>
          We may send product updates and outreach about Mohar itself — but
          only if you give separate, optional consent via the marketing
          opt-in on your profile. Accepting these Terms does not subscribe
          you to marketing. You can withdraw consent at any time, as
          described in the{" "}
          <button className="link" onClick={() => go({ name: "privacy" })}>
            Privacy Policy
          </button>
          .
        </p>

        <h2>10. Third-party services</h2>
        <p>
          The Service relies on third parties, including wallet providers,
          the Helius RPC provider, the Solana network, Supabase, Vercel
          hosting, and Google Fonts. We do not control them and are not
          responsible for their availability, accuracy, or conduct. Their
          terms apply to your use of them.
        </p>

        <h2>11. Intellectual property</h2>
        <p>
          The Mohar name, logo, and brand assets belong to us. Source code
          for the on-chain program and web app may be released under an
          open-source licence in the project's repository; where such a
          licence applies, it governs your rights to that code. Brand assets
          and the Mohar name are excluded from any code licence. If you
          share feedback or suggestions, you grant us a perpetual,
          worldwide, royalty-free licence to use them for any purpose
          without attribution.
        </p>

        <h2>12. Support and contact</h2>
        <p>
          Support is provided on a reasonable-efforts basis. We cannot
          recover funds, reverse transactions, or resolve disagreements
          between users. Contact{" "}
          <a
            href="https://github.com/UrbishCodes"
            target="_blank"
            rel="noreferrer"
          >
            Urbish Ghimire
          </a>{" "}
          for help, and report bugs at{" "}
          <a
            href="https://github.com/UrbishCodes/mohar"
            target="_blank"
            rel="noreferrer"
          >
            github.com/UrbishCodes/mohar
          </a>
          .
        </p>

        <h2>13. Disclaimers</h2>
        <p>
          THE SERVICE AND THE PROGRAM ARE PROVIDED "AS IS" AND "AS
          AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, TO THE FULLEST EXTENT
          PERMITTED BY LAW. WE DO NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, SECURE, OR ERROR-FREE, THAT THE PROGRAM IS FREE OF
          BUGS, THAT ANY ESCROW WILL COMPLETE, OR THAT ANY USER WILL BEHAVE
          HONESTLY. WE ARE NOT A PARTY TO THE AGREEMENTS BETWEEN CLIENTS
          AND FREELANCERS USING MOHAR.
        </p>

        <h2>14. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR FOR LOSS OF FUNDS, TOKENS, PROFITS, DATA, OR GOODWILL,
          ARISING FROM YOUR USE OF THE SERVICE — INCLUDING BUGS, EXPLOITS,
          USER ERROR, ARBITER DECISIONS, OR THIRD-PARTY FAILURES. TO THE
          EXTENT LIABILITY CANNOT BE EXCLUDED, OUR TOTAL LIABILITY IS CAPPED
          AT THE GREATER OF (I) $50 USD AND (II) ANY AMOUNT YOU PAID US IN
          THE SIX MONTHS BEFORE THE CLAIM.
        </p>

        <h2>15. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold us harmless from any
          claims and reasonable costs arising out of your use of the
          Service, your violation of these Terms, or your violation of any
          applicable law.
        </p>

        <h2>16. Suspension and termination</h2>
        <p>
          You may stop using the Service at any time by disconnecting your
          wallet and deleting your profile. We may suspend or end access to
          the web interface at any time, for example for suspected abuse or
          security reasons. Because the Program is on a public blockchain,
          you may still be able to interact with it through other
          interfaces, and we cannot freeze funds held in an escrow. Sections
          that by nature should survive termination will survive.
        </p>

        <h2>17. Changes to these terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will
          be highlighted in the app before they take effect, and the "Last
          updated" date will change. Your continued use of the Service after
          changes are posted constitutes acceptance. Changes do not alter
          the rules of escrows already created on-chain.
        </p>

        <h2>18. Dispute resolution</h2>
        <p>
          Escrow disputes are resolved on-chain by the arbiter named in the
          escrow, and the arbiter's decision is final. For any other dispute
          arising out of these Terms or the Service, the parties agree to
          first attempt to resolve it informally by contacting us as
          described in §12.
        </p>

        <h2>19. General</h2>
        <p>
          These Terms (together with the Privacy Policy) are the entire
          agreement between you and us regarding the Service. If any
          provision is found invalid or unenforceable, it will be modified
          to the minimum extent necessary and the rest will continue in
          effect. Our failure to enforce any provision is not a waiver of
          that provision. You may not assign these Terms without our prior
          written consent; we may assign them in connection with a business
          transfer.
        </p>
      </div>
    </div>
  );
}
