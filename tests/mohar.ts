import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import assert from "assert";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function expectFail(promise: Promise<unknown>, label: string) {
  try {
    await promise;
  } catch (_e) {
    return;
  }
  assert.fail(`expected failure: ${label}`);
}

describe("mohar", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Mohar as anchor.Program;
  const connection = provider.connection;

  const client = Keypair.generate();
  const freelancer = Keypair.generate();
  const arbiter = Keypair.generate();
  const stranger = Keypair.generate();

  let mint: PublicKey;
  let clientAta: PublicKey;
  let freelancerAta: PublicKey;
  let strangerAta: PublicKey;
  let seedCounter = 1000;

  const nowPlus = (secs: number) =>
    new anchor.BN(Math.floor(Date.now() / 1000) + secs);

  function pdas(seed: anchor.BN, clientKey: PublicKey) {
    const [escrow] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        clientKey.toBuffer(),
        seed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), escrow.toBuffer()],
      program.programId
    );
    return { escrow, vault };
  }

  async function tokenBalance(ata: PublicKey): Promise<bigint> {
    return (await getAccount(connection, ata)).amount;
  }

  async function makeEscrow(opts: {
    seed?: anchor.BN;
    amount?: anchor.BN;
    deadlineSecs?: number;
    from?: Keypair;
    freelancerKey?: PublicKey;
    arbiterKey?: PublicKey;
    fundClient?: boolean;
  }) {
    const seed = opts.seed ?? new anchor.BN(seedCounter++);
    const amount = opts.amount ?? new anchor.BN(100_000_000);
    const from = opts.from ?? client;
    const freelancerKey = opts.freelancerKey ?? freelancer.publicKey;
    const arbiterKey = opts.arbiterKey ?? arbiter.publicKey;
    const { escrow, vault } = pdas(seed, from.publicKey);
    const fromAta = getAssociatedTokenAddressSync(mint, from.publicKey);

    if (opts.fundClient) {
      await mintTo(
        connection,
        (provider.wallet as anchor.Wallet).payer,
        mint,
        fromAta,
        provider.wallet.publicKey,
        10_000_000_000
      );
    }

    await program.methods
      .createEscrow(seed, amount, nowPlus(opts.deadlineSecs ?? 3600))
      .accounts({
        client: from.publicKey,
        freelancer: freelancerKey,
        arbiter: arbiterKey,
        mint,
        escrow,
        vault,
        clientAta: fromAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([from])
      .rpc();

    return { seed, amount, escrow, vault, from, fromAta };
  }

  before(async () => {
    // Fund everybody with SOL.
    for (const kp of [client, freelancer, arbiter, stranger]) {
      const sig = await connection.requestAirdrop(
        kp.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig, "confirmed");
    }

    const payer = (provider.wallet as anchor.Wallet).payer;
    mint = await createMint(
      connection,
      payer,
      provider.wallet.publicKey,
      null,
      6
    );

    clientAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        client.publicKey
      )
    ).address;
    freelancerAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        freelancer.publicKey
      )
    ).address;
    strangerAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        stranger.publicKey
      )
    ).address;

    // Client starts with plenty of test-USDC.
    await mintTo(
      connection,
      payer,
      mint,
      clientAta,
      provider.wallet.publicKey,
      100_000_000_000
    );
  });

  it("creates an escrow and locks the funds in the vault", async () => {
    const { seed, amount, escrow, vault } = await makeEscrow({});
    const stored: any = await program.account.escrow.fetch(escrow);

    assert.ok(stored.client.equals(client.publicKey), "client recorded");
    assert.ok(
      stored.freelancer.equals(freelancer.publicKey),
      "freelancer recorded"
    );
    assert.ok(stored.arbiter.equals(arbiter.publicKey), "arbiter recorded");
    assert.ok(stored.mint.equals(mint), "mint recorded");
    assert.ok(stored.seed.eq(seed), "seed recorded");
    assert.ok(stored.amount.eq(amount), "amount recorded");
    assert.deepStrictEqual(
      stored.status,
      { funded: {} },
      "status is Funded"
    );
    assert.strictEqual(
      await tokenBalance(vault),
      BigInt(amount.toString()),
      "vault holds the full amount"
    );
  });

  it("rejects a zero-amount escrow", async () => {
    await expectFail(
      makeEscrow({ amount: new anchor.BN(0) }),
      "zero amount"
    );
  });

  it("rejects a deadline in the past", async () => {
    const seed = new anchor.BN(seedCounter++);
    const { escrow, vault } = pdas(seed, client.publicKey);
    await expectFail(
      program.methods
        .createEscrow(seed, new anchor.BN(100), new anchor.BN(1))
        .accounts({
          client: client.publicKey,
          freelancer: freelancer.publicKey,
          arbiter: arbiter.publicKey,
          mint,
          escrow,
          vault,
          clientAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([client])
        .rpc(),
      "past deadline"
    );
  });

  it("freelancer marks delivered; a stranger cannot", async () => {
    const { escrow } = await makeEscrow({});

    // Stranger tries first — has_one = freelancer must stop them.
    await expectFail(
      program.methods
        .markDelivered()
        .accounts({ escrow, freelancer: stranger.publicKey })
        .signers([stranger])
        .rpc(),
      "stranger mark_delivered"
    );

    await program.methods
      .markDelivered()
      .accounts({ escrow, freelancer: freelancer.publicKey })
      .signers([freelancer])
      .rpc();

    const stored: any = await program.account.escrow.fetch(escrow);
    assert.deepStrictEqual(stored.status, { delivered: {} });
  });

  it("client releases after delivery; vault closes and double-release fails", async () => {
    const { amount, escrow, vault } = await makeEscrow({});
    await program.methods
      .markDelivered()
      .accounts({ escrow, freelancer: freelancer.publicKey })
      .signers([freelancer])
      .rpc();

    const before = await tokenBalance(freelancerAta);
    await program.methods
      .release()
      .accounts({
        escrow,
        client: client.publicKey,
        vault,
        freelancerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([client])
      .rpc();

    assert.strictEqual(
      await tokenBalance(freelancerAta),
      before + BigInt(amount.toString()),
      "freelancer received the full amount"
    );
    const stored: any = await program.account.escrow.fetch(escrow);
    assert.deepStrictEqual(stored.status, { released: {} });
    assert.strictEqual(
      await connection.getAccountInfo(vault),
      null,
      "vault closed, rent reclaimed"
    );

    // Second release must fail.
    await expectFail(
      program.methods
        .release()
        .accounts({
          escrow,
          client: client.publicKey,
          vault,
          freelancerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([client])
        .rpc(),
      "double release"
    );
  });

  it("release before delivery fails", async () => {
    const { escrow, vault } = await makeEscrow({});
    await expectFail(
      program.methods
        .release()
        .accounts({
          escrow,
          client: client.publicKey,
          vault,
          freelancerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([client])
        .rpc(),
      "release while Funded"
    );
  });

  it("rejects a payout to an ATA the freelancer does not own", async () => {
    const { escrow, vault } = await makeEscrow({});
    await program.methods
      .markDelivered()
      .accounts({ escrow, freelancer: freelancer.publicKey })
      .signers([freelancer])
      .rpc();

    // strangerAta has the right mint but the wrong owner.
    await expectFail(
      program.methods
        .release()
        .accounts({
          escrow,
          client: client.publicKey,
          vault,
          freelancerAta: strangerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([client])
        .rpc(),
      "wrong-owner destination"
    );
  });

  it("client refunds before any delivery", async () => {
    const { amount, escrow, vault, fromAta } = await makeEscrow({});
    const before = await tokenBalance(fromAta);

    await program.methods
      .refund()
      .accounts({
        escrow,
        client: client.publicKey,
        vault,
        clientAta: fromAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([client])
      .rpc();

    assert.strictEqual(
      await tokenBalance(fromAta),
      before + BigInt(amount.toString()),
      "client refunded in full"
    );
    const stored: any = await program.account.escrow.fetch(escrow);
    assert.deepStrictEqual(stored.status, { refunded: {} });
  });

  it("deadline claim fails early, then pays the freelancer after expiry", async () => {
    // Too early: deadline an hour out.
    {
      const { escrow, vault } = await makeEscrow({ deadlineSecs: 3600 });
      await expectFail(
        program.methods
          .claimAfterDeadline()
          .accounts({
            escrow,
            freelancer: freelancer.publicKey,
            vault,
            client: client.publicKey,
            freelancerAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([freelancer])
          .rpc(),
        "claim before deadline"
      );
    }

    // After expiry: 3-second deadline, then wait it out.
    const { amount, escrow, vault } = await makeEscrow({ deadlineSecs: 3 });
    await sleep(4500);

    const before = await tokenBalance(freelancerAta);
    await program.methods
      .claimAfterDeadline()
      .accounts({
        escrow,
        freelancer: freelancer.publicKey,
        vault,
        client: client.publicKey,
        freelancerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([freelancer])
      .rpc();

    assert.strictEqual(
      await tokenBalance(freelancerAta),
      before + BigInt(amount.toString()),
      "freelancer claimed after the client ghosted"
    );
    const stored: any = await program.account.escrow.fetch(escrow);
    assert.deepStrictEqual(stored.status, { released: {} });
  });

  it("dispute: client raises, stranger cannot, arbiter pays the freelancer", async () => {
    const { amount, escrow, vault, fromAta } = await makeEscrow({});
    const clientAtaAddr = getAssociatedTokenAddressSync(
      mint,
      client.publicKey
    );

    // Stranger cannot raise a dispute on someone else's escrow.
    await expectFail(
      program.methods
        .raiseDispute()
        .accounts({ escrow, authority: stranger.publicKey })
        .signers([stranger])
        .rpc(),
      "stranger raise_dispute"
    );

    await program.methods
      .raiseDispute()
      .accounts({ escrow, authority: client.publicKey })
      .signers([client])
      .rpc();
    let stored: any = await program.account.escrow.fetch(escrow);
    assert.deepStrictEqual(stored.status, { disputed: {} });

    // Non-arbiter cannot resolve.
    await expectFail(
      program.methods
        .resolveDispute(true)
        .accounts({
          escrow,
          arbiter: stranger.publicKey,
          vault,
          client: client.publicKey,
          freelancerAta,
          clientAta: clientAtaAddr,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc(),
      "stranger resolve_dispute"
    );

    const before = await tokenBalance(freelancerAta);
    await program.methods
      .resolveDispute(true)
      .accounts({
        escrow,
        arbiter: arbiter.publicKey,
        vault,
        client: client.publicKey,
        freelancerAta,
        clientAta: clientAtaAddr,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([arbiter])
      .rpc();

    assert.strictEqual(
      await tokenBalance(freelancerAta),
      before + BigInt(amount.toString()),
      "arbiter paid the freelancer"
    );
    stored = await program.account.escrow.fetch(escrow);
    assert.deepStrictEqual(stored.status, { resolved: {} });
    assert.strictEqual(fromAta.toBase58(), clientAta.toBase58());
  });

  it("dispute: arbiter can also refund the client", async () => {
    const { amount, escrow, vault } = await makeEscrow({});
    const clientAtaAddr = getAssociatedTokenAddressSync(
      mint,
      client.publicKey
    );

    await program.methods
      .raiseDispute()
      .accounts({ escrow, authority: freelancer.publicKey })
      .signers([freelancer])
      .rpc();

    const before = await tokenBalance(clientAtaAddr);
    await program.methods
      .resolveDispute(false)
      .accounts({
        escrow,
        arbiter: arbiter.publicKey,
        vault,
        client: client.publicKey,
        freelancerAta,
        clientAta: clientAtaAddr,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([arbiter])
      .rpc();

    assert.strictEqual(
      await tokenBalance(clientAtaAddr),
      before + BigInt(amount.toString()),
      "arbiter refunded the client"
    );
    const stored: any = await program.account.escrow.fetch(escrow);
    assert.deepStrictEqual(stored.status, { resolved: {} });
  });

  it("cannot dispute an already-released escrow", async () => {
    const { escrow, vault } = await makeEscrow({});
    await program.methods
      .markDelivered()
      .accounts({ escrow, freelancer: freelancer.publicKey })
      .signers([freelancer])
      .rpc();
    await program.methods
      .release()
      .accounts({
        escrow,
        client: client.publicKey,
        vault,
        freelancerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([client])
      .rpc();

    await expectFail(
      program.methods
        .raiseDispute()
        .accounts({ escrow, authority: client.publicKey })
        .signers([client])
        .rpc(),
      "dispute after release"
    );
  });
});
