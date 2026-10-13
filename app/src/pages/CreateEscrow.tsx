import { useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import type { View } from "../components/TopBar";
import { hasAcceptedLegal, markLegalAccepted } from "../lib/legal";
import {
  getProgram,
  findEscrowPda,
  findVaultPda,
  getOrCreateAta,
  tokenProgramId,
  SystemProgram,
} from "../lib/mohar";
import { getMintAddress } from "../lib/config";
import { Field, Notice, Addr, Icon } from "../components/ui";
import { TxModal, type TxAction, type TxModalState } from "../components/TxModals";
import { DatePicker, formatDateLabel } from "../components/DatePicker";

function validAddr(v: string): boolean {
  try {
    new PublicKey(v.trim());
    return true;
  } catch {
    return false;
  }
}

export default function CreateEscrow({ go }: { go: (v: View) => void }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [freelancer, setFreelancer] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [deadlineTextError, setDeadlineTextError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [accepted, setAccepted] = useState<boolean>(() => hasAcceptedLegal());
  const [ackDevnet, setAckDevnet] = useState(false);
  const [txModal, setTxModal] = useState<TxModalState | null>(null);
  const [createdEscrow, setCreatedEscrow] = useState<string | null>(null);

  const me = publicKey?.toBase58() ?? "";

  const errFreelancer = useMemo(() => {
    if (!touched.freelancer) return null;
    if (!validAddr(freelancer)) return "That is not a valid Solana address.";
    if (freelancer.trim() === me) return "You can't be your own freelancer.";
    if (arbiter && validAddr(arbiter) && freelancer.trim() === arbiter.trim())
      return "Freelancer and arbiter must be different wallets.";
    return null;
  }, [freelancer, arbiter, touched.freelancer, me]);

  const errArbiter = useMemo(() => {
    if (!touched.arbiter) return null;
    if (!validAddr(arbiter)) return "That is not a valid Solana address.";
    if (arbiter.trim() === me) return "You can't be your own arbiter.";
    return null;
  }, [arbiter, touched.arbiter, me]);

  const errAmount = useMemo(() => {
    if (!touched.amount) return null;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return "Amount must be greater than zero.";
    return null;
  }, [amount, touched.amount]);

  const errDeadline = useMemo(() => {
    if (!touched.deadline) return null;
    if (deadlineTextError) return deadlineTextError;
    if (!deadline) return "Choose a deadline.";
    return null;
  }, [deadline, deadlineTextError, touched.deadline]);

  const stepValid = (s: 1 | 2 | 3): boolean => {
    if (s === 1)
      return (
        validAddr(freelancer) &&
        validAddr(arbiter) &&
        freelancer.trim() !== me &&
        arbiter.trim() !== me &&
        freelancer.trim() !== arbiter.trim()
      );
    if (s === 2) {
      const n = Number(amount);
      return (
        Number.isFinite(n) &&
        n > 0 &&
        deadline !== null &&
        !deadlineTextError
      );
    }
    return accepted && ackDevnet;
  };

  const deadlineLabel = useMemo(() => {
    if (!deadline) return "—";
    const eod = new Date(
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate(),
      23,
      59,
      59
    );
    return eod.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [deadline]);

  /* the sealed-until note under the field: exact local time + UTC equivalent */
  const deadlineNote = useMemo(() => {
    if (!deadline) return null;
    const e = new Date(
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate(),
      23,
      59,
      59
    );
    const tz =
      new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" })
        .formatToParts(e)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    const t = e
      .toLocaleTimeString("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toUpperCase();
    const u = `${String(e.getUTCHours()).padStart(2, "0")}:${String(
      e.getUTCMinutes()
    ).padStart(2, "0")} UTC`;
    const n = Math.round(
      (new Date(
        deadline.getFullYear(),
        deadline.getMonth(),
        deadline.getDate()
      ).getTime() -
        new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          new Date().getDate()
        ).getTime()) /
        864e5
    );
    return { label: formatDateLabel(deadline), time: t, tz, utc: u, days: n };
  }, [deadline]);

  const createTx = async (): Promise<{ sig: string; escrow: string }> => {
    const freelancerPk = new PublicKey(freelancer.trim());
    const arbiterPk = new PublicKey(arbiter.trim());
    const mint = new PublicKey(getMintAddress());
    const mintInfo = await getMint(connection, mint);
    const amountBase = BigInt(
      Math.round(Number(amount) * 10 ** mintInfo.decimals)
    );
    const program = getProgram(connection, wallet);
    const seed = new BN(
      BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString()
    );
    const [escrowPda] = await findEscrowPda(publicKey!, seed);
    const [vaultPda] = await findVaultPda(escrowPda);
    // end of the chosen local day — never UTC midnight (timezone bug fix)
    const deadlineTs = Math.floor(
      new Date(
        deadline!.getFullYear(),
        deadline!.getMonth(),
        deadline!.getDate(),
        23,
        59,
        59
      ).getTime() / 1000
    );

    const clientAta = await getOrCreateAta(
      connection,
      publicKey!,
      mint,
      publicKey!,
      async (tx: Transaction) => {
        const s = await sendTransaction(tx, connection);
        await connection.confirmTransaction(s, "confirmed");
        return s;
      }
    );

    const sig = await program.methods
      .createEscrow(seed, new BN(amountBase.toString()), new BN(deadlineTs))
      .accounts({
        escrow: escrowPda,
        client: publicKey!,
        freelancer: freelancerPk,
        arbiter: arbiterPk,
        mint,
        vault: vaultPda,
        clientAta,
        tokenProgram: tokenProgramId,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await connection.confirmTransaction(sig, "confirmed");
    return { sig, escrow: escrowPda.toBase58() };
  };

  const openReview = () => {
    if (!stepValid(3) || !publicKey) return;
    const amt = `${Number(amount).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })} USDC`;
    const action: TxAction = {
      key: "create",
      title: `Lock ${amt}?`,
      sub: "Check the details. The funds leave your wallet now.",
      rows: [
        ["Freelancer", <Addr key="f" addr={freelancer.trim()} />],
        ["Arbiter", <Addr key="a" addr={arbiter.trim()} />],
        ["Amount", <b key="amt">{amt}</b>],
        ["Deadline", <span key="dl">{deadlineLabel} (your time)</span>],
      ],
      warning: `${amt} leaves your wallet now and stays in a program-owned vault until release, refund, claim or dispute.`,
      confirmLabel: `Lock ${amt}`,
      confirmClass: "btn-primary",
      run: async () => {
        const { sig, escrow } = await createTx();
        setCreatedEscrow(escrow);
        return sig;
      },
      sealedTitle: "Escrow sealed",
      sealedSub: `${amt} is now locked in the vault. The freelancer can see the deal.`,
      sealedStatus: "Funded",
    };
    setTxModal({ stage: "review", action });
  };

  const confirmTx = async () => {
    if (!txModal || txModal.stage !== "review") return;
    const action = txModal.action;
    setTxModal({ stage: "progress", action, phase: 1 });
    try {
      const sig = await action.run();
      setTxModal({ stage: "progress", action, phase: 2 });
      // createTx already confirmed; move straight to sealed
      setTxModal({ stage: "sealed", action, sig });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setTxModal({
        stage: "error",
        action,
        message: msg.length > 300 ? msg.slice(0, 300) + "…" : msg,
      });
    }
  };

  if (!wallet.connected) {
    return (
      <div className="page">
        <div className="empty">
          <div className="big">🔒</div>
          <h2>Connect your wallet</h2>
          <p>Connect a Solana wallet to create an escrow.</p>
        </div>
      </div>
    );
  }

  const closeModal = () => {
    if (txModal?.stage === "sealed" && createdEscrow) {
      go({ name: "detail", escrow: createdEscrow });
      return;
    }
    setTxModal(null);
  };

  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  return (
    <div className="page">
      <div className="page-wrap-cq">
        <div className="detail-head">
          <div>
            <h2 style={{ margin: "0 0 4px", font: "600 28px var(--display)" }}>
              New escrow
            </h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
              Lock USDC for a freelancer. Sealed until delivery or the deadline.
            </p>
          </div>
        </div>

        <div className="crs" aria-label="Progress">
          <span className={step > 1 ? "ok" : step === 1 ? "on" : ""}>
            1 Parties {step > 1 ? "✓" : ""}
          </span>
          <span className={step > 2 ? "ok" : step === 2 ? "on" : ""}>
            2 Terms {step > 2 ? "✓" : ""}
          </span>
          <span className={step === 3 ? "on" : ""}>3 Review and lock</span>
        </div>

        <div className="cr">
          <div>
            {step === 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (stepValid(1)) setStep(2);
                  else setTouched({ freelancer: true, arbiter: true });
                }}
              >
                <Field
                  label="Freelancer wallet address"
                  hint="Checked as you paste. Must differ from your wallet."
                  error={errFreelancer}
                >
                  <input
                    className={`mono${errFreelancer ? " err" : ""}`}
                    placeholder="Paste a Solana address"
                    value={freelancer}
                    spellCheck={false}
                    onChange={(e) => {
                      setFreelancer(e.target.value);
                      touch("freelancer");
                    }}
                  />
                </Field>
                <Field
                  label="Arbiter wallet address"
                  hint="Someone both sides trust. They can only act if a dispute is raised."
                  error={errArbiter}
                >
                  <input
                    className={`mono${errArbiter ? " err" : ""}`}
                    placeholder="Paste a Solana address"
                    value={arbiter}
                    spellCheck={false}
                    onChange={(e) => {
                      setArbiter(e.target.value);
                      touch("arbiter");
                    }}
                  />
                </Field>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!stepValid(1)}
                  >
                    Continue to terms
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (stepValid(2)) setStep(3);
                  else setTouched({ amount: true, deadline: true });
                }}
              >
                <Field
                  label="Amount (USDC)"
                  hint="Your balance: —"
                  error={errAmount}
                >
                  <input
                    className={errAmount ? "err" : ""}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="500.00"
                    value={amount}
                    inputMode="decimal"
                    onChange={(e) => {
                      setAmount(e.target.value);
                      touch("amount");
                    }}
                  />
                </Field>
                <div className="field">
                  <label htmlFor="deadline">Deadline</label>
                  <div className="hint above" id="deadline-hint">
                    The deadline is the end of the day you pick, in your local
                    time. After it, the freelancer can claim on an accepted job,
                    or you can reclaim if it was never accepted.
                  </div>
                  <DatePicker
                    id="deadline"
                    value={deadline}
                    onChange={(d) => {
                      setDeadline(d);
                      touch("deadline");
                    }}
                    onTextError={(msg) => {
                      setDeadlineTextError(msg);
                      touch("deadline");
                    }}
                    error={errDeadline}
                    describedBy="deadline-hint"
                  />
                  {errDeadline && (
                    <div className="error" role="alert">
                      {errDeadline}
                    </div>
                  )}
                  {deadline && !errDeadline && deadlineNote && (
                    <div className="dp-note">
                      <Icon name="info" size={16} />
                      <span>
                        Funds stay sealed until{" "}
                        <b>
                          {deadlineNote.label}, {deadlineNote.time}
                        </b>{" "}
                        ({deadlineNote.tz}, {deadlineNote.utc}). That is{" "}
                        {deadlineNote.days} day
                        {deadlineNote.days === 1 ? "" : "s"} from today. After
                        that the freelancer can claim on an accepted job.
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!stepValid(2)}
                  >
                    Review escrow
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <div style={{ display: "grid", gap: 16 }}>
                <div className="card" style={{ padding: "6px 18px" }}>
                  <div className="party">
                    <b>Freelancer</b>
                    <Addr addr={freelancer.trim()} />
                  </div>
                  <div className="party">
                    <b>Arbiter</b>
                    <Addr addr={arbiter.trim()} />
                  </div>
                  <div className="party">
                    <b>Amount</b>
                    <b>
                      {Number(amount).toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      USDC
                    </b>
                  </div>
                  <div className="party">
                    <b>Deadline</b>
                    <span>{deadlineLabel} (your time)</span>
                  </div>
                </div>

                <Notice kind="info" icon="lock">
                  {Number(amount).toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  USDC leaves your wallet now and stays in a program-owned
                  vault until release, refund, claim or dispute.
                </Notice>

                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    fontSize: 14,
                    color: "var(--muted)",
                    alignItems: "flex-start",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ackDevnet}
                    onChange={(e) => setAckDevnet(e.target.checked)}
                    style={{ marginTop: 4, accentColor: "var(--primary)" }}
                  />
                  <span>
                    I understand this is devnet with test USDC and has not
                    been audited.
                  </span>
                </label>

                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    fontSize: 14,
                    color: "var(--muted)",
                    alignItems: "flex-start",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => {
                      setAccepted(e.target.checked);
                      if (e.target.checked) markLegalAccepted();
                    }}
                    style={{ marginTop: 4, accentColor: "var(--primary)" }}
                  />
                  <span>
                    I agree to the{" "}
                    <button
                      type="button"
                      className="link"
                      onClick={() => go({ name: "terms" })}
                    >
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      className="link"
                      onClick={() => go({ name: "privacy" })}
                    >
                      Privacy Policy
                    </button>
                    .
                  </span>
                </label>

                <div
                  style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                >
                  <button className="btn" onClick={() => setStep(2)}>
                    Back
                  </button>
                  <button
                    className="btn btn-primary btn-lg"
                    style={{ flex: 1 }}
                    disabled={!stepValid(3)}
                    onClick={openReview}
                  >
                    Lock{" "}
                    {Number(amount).toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    USDC
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* live summary */}
          <aside className="card" style={{ fontSize: 14 }}>
            <div
              className="eyebrow"
              style={{
                font: "600 12px/1 var(--ui)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 12,
              }}
            >
              What happens next
            </div>
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                display: "grid",
                gap: 6,
                color: "var(--muted)",
              }}
            >
              <li>Wallet approval</li>
              <li>Funds move to the vault</li>
              <li>The freelancer sees the deal</li>
            </ol>
            {(freelancer || amount || deadline) && (
              <div
                className="rows"
                style={{ marginTop: 14, marginBottom: 0 }}
              >
                {freelancer && validAddr(freelancer) && (
                  <div>
                    <span>To</span>
                    <Addr addr={freelancer.trim()} />
                  </div>
                )}
                {amount && Number(amount) > 0 && (
                  <div>
                    <span>Amount</span>
                    <b>
                      {Number(amount).toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      USDC
                    </b>
                  </div>
                )}
                <div>
                  <span>Deadline</span>
                  {deadline ? (
                    <b>{formatDateLabel(deadline)}</b>
                  ) : (
                    <span className="muted">Not set</span>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {txModal && (
        <TxModal
          state={txModal}
          onClose={closeModal}
          onConfirm={confirmTx}
          onRetry={confirmTx}
        />
      )}
    </div>
  );
}
