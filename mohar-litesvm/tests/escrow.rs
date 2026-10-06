//! LiteSVM integration tests for the Mohar escrow program.
//!
//! This mirrors `tests/mohar.ts` (the canonical `anchor test` suite) so the
//! on-chain program is fully validated even in environments where a local
//! validator cannot process transactions.

use borsh::BorshDeserialize;
use litesvm::LiteSVM;
use solana_address::{address, Address};
use solana_clock::Clock;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_system_interface::instruction as system_ix;
use solana_transaction::Transaction;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
const MOHAR_ID: Address = address!("Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ");
/// Fixed clock so deadline math is deterministic across runs.
const START_TS: i64 = 1_800_000_000;

// Anchor discriminators: sha256("global:<name>")[..8]
const D_CREATE: [u8; 8] = [253, 215, 165, 116, 36, 108, 68, 80];
const D_DELIVER: [u8; 8] = [240, 118, 188, 142, 64, 85, 107, 18];
const D_RELEASE: [u8; 8] = [253, 249, 15, 206, 28, 127, 193, 241];
const D_REFUND: [u8; 8] = [2, 96, 183, 251, 63, 208, 46, 46];
const D_CLAIM: [u8; 8] = [55, 47, 158, 12, 61, 132, 211, 150];
const D_DISPUTE: [u8; 8] = [41, 243, 1, 51, 150, 95, 246, 73];
const D_RESOLVE: [u8; 8] = [231, 6, 202, 6, 96, 103, 12, 230];

// EscrowStatus discriminants (must match the program's enum order)
const S_FUNDED: u8 = 0;
const S_DELIVERED: u8 = 1;
const S_RELEASED: u8 = 2;
const S_REFUNDED: u8 = 3;
const S_DISPUTED: u8 = 4;
const S_RESOLVED: u8 = 5;

// System program: 11111111111111111111111111111111
const SYSTEM_PID: Address = Address::new_from_array([0u8; 32]);

// Anchor #[error_code] codes: 6000 + variant index
const E_INVALID_AMOUNT: u32 = 6000;
const E_INVALID_DEADLINE: u32 = 6001;
const E_INVALID_STATUS: u32 = 6002;
const E_DEADLINE_NOT_REACHED: u32 = 6003;
const E_UNAUTHORIZED: u32 = 6004;
const E_INVALID_DESTINATION: u32 = 6005;

fn token_pid() -> Address {
    Address::new_from_array(spl_token::ID.to_bytes())
}

// spl-token 7 still speaks the old solana-program types; convert via bytes.
type SpPubkey = spl_token::solana_program::pubkey::Pubkey;
type SpInstruction = spl_token::solana_program::instruction::Instruction;
use spl_token::solana_program::program_pack::Pack as _;

fn sp_to_addr(p: &SpPubkey) -> Address {
    Address::new_from_array(p.to_bytes())
}

fn sp_addr(kp: &Keypair) -> SpPubkey {
    SpPubkey::new_from_array(kp.pubkey().to_bytes())
}

fn convert_ix(ix: SpInstruction) -> Instruction {
    Instruction {
        program_id: sp_to_addr(&ix.program_id),
        accounts: ix
            .accounts
            .into_iter()
            .map(|m| AccountMeta {
                pubkey: sp_to_addr(&m.pubkey),
                is_signer: m.is_signer,
                is_writable: m.is_writable,
            })
            .collect(),
        data: ix.data,
    }
}

// ---------------------------------------------------------------------------
// Test environment
// ---------------------------------------------------------------------------

struct Env {
    svm: LiteSVM,
    client: Keypair,
    freelancer: Keypair,
    arbiter: Keypair,
    stranger: Keypair,
    mint: Keypair,
    client_ata: Keypair,
    freelancer_ata: Keypair,
    stranger_ata: Keypair,
}

fn am(pubkey: Address, is_writable: bool, is_signer: bool) -> AccountMeta {
    AccountMeta {
        pubkey,
        is_signer,
        is_writable,
    }
}

fn send(svm: &mut LiteSVM, ixs: &[Instruction], signers: &[&Keypair]) {
    let payer = signers[0];
    let dyn_signers: Vec<&dyn Signer> = signers.iter().map(|s| *s as &dyn Signer).collect();
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &bh);
    let tx = Transaction::new(dyn_signers.as_slice(), msg, bh);
    svm.send_transaction(tx).unwrap();
}

fn send_expect_err(svm: &mut LiteSVM, ixs: &[Instruction], signers: &[&Keypair]) -> Vec<String> {
    let payer = signers[0];
    let dyn_signers: Vec<&dyn Signer> = signers.iter().map(|s| *s as &dyn Signer).collect();
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &bh);
    let tx = Transaction::new(dyn_signers.as_slice(), msg, bh);
    match svm.send_transaction(tx) {
        Ok(_) => panic!("expected transaction to fail, but it succeeded"),
        Err(e) => e.meta.logs,
    }
}

fn assert_custom_err(logs: &[String], code: u32) {
    let needle = format!("custom program error: {:#x}", code);
    assert!(
        logs.iter().any(|l| l.contains(&needle)),
        "expected '{}' in logs:\n{}",
        needle,
        logs.join("\n")
    );
}

fn set_time(svm: &mut LiteSVM, ts: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = ts;
    svm.set_sysvar(&clock);
}

fn setup() -> Env {
    let mut svm = LiteSVM::new();
    svm.add_program(
        MOHAR_ID,
        include_bytes!("../../target/deploy/mohar.so"),
    )
    .unwrap();
    // NOTE: LiteSVM 0.17 already bundles spl_token 3.5.0 at the standard
    // program id — no need to add it ourselves.

    let client = Keypair::new();
    let freelancer = Keypair::new();
    let arbiter = Keypair::new();
    let stranger = Keypair::new();
    let mint = Keypair::new();
    let mint_auth = Keypair::new();
    let client_ata = Keypair::new();
    let freelancer_ata = Keypair::new();
    let stranger_ata = Keypair::new();

    for kp in [&client, &freelancer, &arbiter, &stranger] {
        svm.airdrop(&kp.pubkey(), 10 * LAMPORTS_PER_SOL).unwrap();
    }
    set_time(&mut svm, START_TS);

    let tpid = token_pid();
    let mint_sp = sp_addr(&mint);
    let auth_sp = sp_addr(&mint_auth);

    // Create the USDC-like mint (6 decimals).
    let rent_mint = svm.minimum_balance_for_rent_exemption(spl_token::state::Mint::LEN);
    send(
        &mut svm,
        &[
            system_ix::create_account(
                &client.pubkey(),
                &mint.pubkey(),
                rent_mint,
                spl_token::state::Mint::LEN as u64,
                &tpid,
            ),
            convert_ix(
                spl_token::instruction::initialize_mint(
                    &spl_token::ID,
                    &mint_sp,
                    &auth_sp,
                    None,
                    6,
                )
                .unwrap(),
            ),
        ],
        &[&client, &mint],
    );

    // Create token accounts for client / freelancer / stranger.
    for (ata, owner) in [
        (&client_ata, &client),
        (&freelancer_ata, &freelancer),
        (&stranger_ata, &stranger),
    ] {
        let rent = svm.minimum_balance_for_rent_exemption(spl_token::state::Account::LEN);
        send(
            &mut svm,
            &[
                system_ix::create_account(
                    &client.pubkey(),
                    &ata.pubkey(),
                    rent,
                    spl_token::state::Account::LEN as u64,
                    &tpid,
                ),
                convert_ix(
                    spl_token::instruction::initialize_account(
                        &spl_token::ID,
                        &sp_addr(ata),
                        &mint_sp,
                        &sp_addr(owner),
                    )
                    .unwrap(),
                ),
            ],
            &[&client, ata],
        );
    }

    // Fund the client with 1000 USDC.
    send(
        &mut svm,
        &[convert_ix(
            spl_token::instruction::mint_to(
                &spl_token::ID,
                &mint_sp,
                &sp_addr(&client_ata),
                &auth_sp,
                &[],
                1_000_000_000,
            )
            .unwrap(),
        )],
        &[&client, &mint_auth],
    );

    Env {
        svm,
        client,
        freelancer,
        arbiter,
        stranger,
        mint,
        client_ata,
        freelancer_ata,
        stranger_ata,
    }
}

// ---------------------------------------------------------------------------
// State readers
// ---------------------------------------------------------------------------

/// Token Account layout: mint(32) + owner(32) + amount(u64 @ offset 64).
fn token_balance(svm: &LiteSVM, ata: &Address) -> u64 {
    let acc = svm.get_account(ata).expect("token account missing");
    u64::from_le_bytes(acc.data[64..72].try_into().unwrap())
}

#[derive(BorshDeserialize)]
struct EscrowState {
    _client: [u8; 32],
    _freelancer: [u8; 32],
    _arbiter: [u8; 32],
    _mint: [u8; 32],
    _seed: u64,
    _amount: u64,
    _deadline: i64,
    status: u8,
    _bump: u8,
    _vault_bump: u8,
}

fn escrow_status(svm: &LiteSVM, escrow: &Address) -> u8 {
    let acc = svm.get_account(escrow).expect("escrow account missing");
    EscrowState::try_from_slice(&acc.data[8..]).unwrap().status
}

fn account_exists(svm: &LiteSVM, addr: &Address) -> bool {
    svm.get_account(addr).is_some()
}

// ---------------------------------------------------------------------------
// Mohar instruction builders
// ---------------------------------------------------------------------------

fn pdas(client: &Address, seed: u64) -> (Address, Address) {
    let (escrow, _) = Address::find_program_address(
        &[b"escrow", client.as_ref(), &seed.to_le_bytes()],
        &MOHAR_ID,
    );
    let (vault, _) = Address::find_program_address(&[b"vault", escrow.as_ref()], &MOHAR_ID);
    (escrow, vault)
}

fn ix_create(env: &Env, escrow: &Address, vault: &Address, seed: u64, amount: u64, deadline: i64) -> Instruction {
    let mut data = D_CREATE.to_vec();
    data.extend_from_slice(&seed.to_le_bytes());
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(&deadline.to_le_bytes());
    Instruction {
        program_id: MOHAR_ID,
        accounts: vec![
            am(env.client.pubkey(), true, true),
            am(env.freelancer.pubkey(), false, false),
            am(env.arbiter.pubkey(), false, false),
            am(env.mint.pubkey(), false, false),
            am(*escrow, true, false),
            am(*vault, true, false),
            am(env.client_ata.pubkey(), true, false),
            am(token_pid(), false, false),
            am(SYSTEM_PID, false, false),
        ],
        data,
    }
}

fn create_escrow(env: &mut Env, seed: u64, amount: u64, deadline: i64) -> (Address, Address) {
    let (escrow, vault) = pdas(&env.client.pubkey(), seed);
    let ix = ix_create(env, &escrow, &vault, seed, amount, deadline);
    send(&mut env.svm, &[ix], &[&env.client]);
    (escrow, vault)
}

fn ix_deliver(escrow: &Address, signer: &Address) -> Instruction {
    Instruction {
        program_id: MOHAR_ID,
        accounts: vec![am(*escrow, true, false), am(*signer, false, true)],
        data: D_DELIVER.to_vec(),
    }
}

fn ix_release(env: &Env, escrow: &Address, vault: &Address, dest_ata: &Address) -> Instruction {
    Instruction {
        program_id: MOHAR_ID,
        accounts: vec![
            am(*escrow, true, false),
            am(env.client.pubkey(), false, true),
            am(*vault, true, false),
            am(*dest_ata, true, false),
            am(token_pid(), false, false),
        ],
        data: D_RELEASE.to_vec(),
    }
}

fn ix_refund(env: &Env, escrow: &Address, vault: &Address) -> Instruction {
    Instruction {
        program_id: MOHAR_ID,
        accounts: vec![
            am(*escrow, true, false),
            am(env.client.pubkey(), false, true),
            am(*vault, true, false),
            am(env.client_ata.pubkey(), true, false),
            am(token_pid(), false, false),
        ],
        data: D_REFUND.to_vec(),
    }
}

#[allow(clippy::too_many_arguments)]
fn ix_claim(
    env: &Env,
    escrow: &Address,
    vault: &Address,
    rent_to: &Address,
    dest_ata: &Address,
) -> Instruction {
    Instruction {
        program_id: MOHAR_ID,
        accounts: vec![
            am(*escrow, true, false),
            am(env.freelancer.pubkey(), false, true),
            am(*vault, true, false),
            am(*rent_to, true, false),
            am(*dest_ata, true, false),
            am(token_pid(), false, false),
        ],
        data: D_CLAIM.to_vec(),
    }
}

fn ix_dispute(escrow: &Address, authority: &Address) -> Instruction {
    Instruction {
        program_id: MOHAR_ID,
        accounts: vec![am(*escrow, true, false), am(*authority, false, true)],
        data: D_DISPUTE.to_vec(),
    }
}

fn ix_resolve(
    env: &Env,
    escrow: &Address,
    vault: &Address,
    pay_freelancer: bool,
) -> Instruction {
    let mut data = D_RESOLVE.to_vec();
    data.push(u8::from(pay_freelancer));
    Instruction {
        program_id: MOHAR_ID,
        accounts: vec![
            am(*escrow, true, false),
            am(env.arbiter.pubkey(), false, true),
            am(*vault, true, false),
            am(env.client.pubkey(), true, false),
            am(env.freelancer_ata.pubkey(), true, false),
            am(env.client_ata.pubkey(), true, false),
            am(token_pid(), false, false),
        ],
        data,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn create_and_fund() {
    let mut env = setup();
    let amount = 1_000_000u64; // 1 USDC
    let (escrow, vault) = create_escrow(&mut env, 7, amount, START_TS + 3600);

    assert_eq!(escrow_status(&env.svm, &escrow), S_FUNDED);
    assert_eq!(token_balance(&env.svm, &vault), amount);
    assert_eq!(
        token_balance(&env.svm, &env.client_ata.pubkey()),
        1_000_000_000 - amount
    );
}

#[test]
fn reject_zero_amount() {
    let mut env = setup();
    let (escrow, vault) = pdas(&env.client.pubkey(), 8);
    let ix = ix_create(&env, &escrow, &vault, 8, 0, START_TS + 3600);
    let logs = send_expect_err(&mut env.svm, &[ix], &[&env.client]);
    assert_custom_err(&logs, E_INVALID_AMOUNT);
}

#[test]
fn reject_past_deadline() {
    let mut env = setup();
    let (escrow, vault) = pdas(&env.client.pubkey(), 9);
    let ix = ix_create(&env, &escrow, &vault, 9, 1_000_000, START_TS - 10);
    let logs = send_expect_err(&mut env.svm, &[ix], &[&env.client]);
    assert_custom_err(&logs, E_INVALID_DEADLINE);
}

#[test]
fn deliver_and_release_happy_path() {
    let mut env = setup();
    let amount = 2_500_000u64;
    let (escrow, vault) = create_escrow(&mut env, 10, amount, START_TS + 3600);

    // Freelancer marks delivered.
    send(
        &mut env.svm,
        &[ix_deliver(&escrow, &env.freelancer.pubkey())],
        &[&env.freelancer],
    );
    assert_eq!(escrow_status(&env.svm, &escrow), S_DELIVERED);

    // Client releases.
    let freelancer_ata = env.freelancer_ata.pubkey();
    let pay_ix = ix_release(&env, &escrow, &vault, &freelancer_ata);
    send(&mut env.svm, &[pay_ix], &[&env.client]);
    assert_eq!(escrow_status(&env.svm, &escrow), S_RELEASED);
    assert_eq!(token_balance(&env.svm, &freelancer_ata), amount);
    assert!(
        !account_exists(&env.svm, &vault),
        "vault should be closed after payout"
    );
}

#[test]
fn reject_double_release() {
    let mut env = setup();
    let (escrow, vault) = create_escrow(&mut env, 11, 1_000_000, START_TS + 3600);
    send(
        &mut env.svm,
        &[ix_deliver(&escrow, &env.freelancer.pubkey())],
        &[&env.freelancer],
    );
    let freelancer_ata = env.freelancer_ata.pubkey();
    let ix = ix_release(&env, &escrow, &vault, &freelancer_ata);
    send(&mut env.svm, &[ix.clone()], &[&env.client]);

    // The vault was closed by the first release, so a second release cannot
    // even load its accounts — the key point is no double-spend happens.
    let balance_before = token_balance(&env.svm, &freelancer_ata);
    let _logs = send_expect_err(&mut env.svm, &[ix], &[&env.client]);
    assert_eq!(escrow_status(&env.svm, &escrow), S_RELEASED);
    assert_eq!(token_balance(&env.svm, &freelancer_ata), balance_before);
}

#[test]
fn reject_release_before_delivery() {
    let mut env = setup();
    let (escrow, vault) = create_escrow(&mut env, 12, 1_000_000, START_TS + 3600);
    let freelancer_ata = env.freelancer_ata.pubkey();
    let ix = ix_release(&env, &escrow, &vault, &freelancer_ata);
    let logs = send_expect_err(&mut env.svm, &[ix], &[&env.client]);
    assert_custom_err(&logs, E_INVALID_STATUS);
}

#[test]
fn reject_unauthorized_delivery() {
    let mut env = setup();
    let (escrow, _) = create_escrow(&mut env, 13, 1_000_000, START_TS + 3600);
    // A stranger tries to mark the work delivered.
    let ix = ix_deliver(&escrow, &env.stranger.pubkey());
    let logs = send_expect_err(&mut env.svm, &[ix], &[&env.stranger]);
    assert!(
        logs.iter().any(|l| l.contains("Error Number: 2001")),
        "expected has_one (2001) failure in logs:\n{}",
        logs.join("\n")
    );
}

#[test]
fn reject_wrong_owner_payout_destination() {
    let mut env = setup();
    let (escrow, vault) = create_escrow(&mut env, 14, 1_000_000, START_TS + 3600);
    send(
        &mut env.svm,
        &[ix_deliver(&escrow, &env.freelancer.pubkey())],
        &[&env.freelancer],
    );
    // Attacker passes their own token account as the freelancer payout.
    let stranger_ata = env.stranger_ata.pubkey();
    let ix = ix_release(&env, &escrow, &vault, &stranger_ata);
    let logs = send_expect_err(&mut env.svm, &[ix], &[&env.client]);
    assert_custom_err(&logs, E_INVALID_DESTINATION);
    // Funds must still be locked.
    assert_eq!(escrow_status(&env.svm, &escrow), S_DELIVERED);
    assert_eq!(token_balance(&env.svm, &vault), 1_000_000);
}

#[test]
fn refund_before_delivery() {
    let mut env = setup();
    let amount = 1_000_000u64;
    let (escrow, vault) = create_escrow(&mut env, 15, amount, START_TS + 3600);

    let refund_ix = ix_refund(&env, &escrow, &vault);
    send(&mut env.svm, &[refund_ix], &[&env.client]);
    assert_eq!(escrow_status(&env.svm, &escrow), S_REFUNDED);
    assert_eq!(
        token_balance(&env.svm, &env.client_ata.pubkey()),
        1_000_000_000
    );
    assert!(
        !account_exists(&env.svm, &vault),
        "vault should be closed after refund"
    );
}

#[test]
fn claim_after_deadline() {
    let mut env = setup();
    let amount = 1_000_000u64;
    let (escrow, vault) = create_escrow(&mut env, 16, amount, START_TS + 100);
    send(
        &mut env.svm,
        &[ix_deliver(&escrow, &env.freelancer.pubkey())],
        &[&env.freelancer],
    );

    // Client ghosts; time passes.
    set_time(&mut env.svm, START_TS + 200);
    let client = env.client.pubkey();
    let freelancer_ata = env.freelancer_ata.pubkey();
    let claim_ix = ix_claim(&env, &escrow, &vault, &client, &freelancer_ata);
    send(&mut env.svm, &[claim_ix], &[&env.freelancer]);
    assert_eq!(escrow_status(&env.svm, &escrow), S_RELEASED);
    assert_eq!(token_balance(&env.svm, &freelancer_ata), amount);
    assert!(!account_exists(&env.svm, &vault));
}

#[test]
fn reject_early_claim() {
    let mut env = setup();
    let (escrow, vault) = create_escrow(&mut env, 17, 1_000_000, START_TS + 3600);
    send(
        &mut env.svm,
        &[ix_deliver(&escrow, &env.freelancer.pubkey())],
        &[&env.freelancer],
    );
    let client = env.client.pubkey();
    let freelancer_ata = env.freelancer_ata.pubkey();
    let ix = ix_claim(&env, &escrow, &vault, &client, &freelancer_ata);
    let logs = send_expect_err(&mut env.svm, &[ix], &[&env.freelancer]);
    assert_custom_err(&logs, E_DEADLINE_NOT_REACHED);
}

#[test]
fn reject_claim_with_wrong_rent_recipient() {
    let mut env = setup();
    let (escrow, vault) = create_escrow(&mut env, 18, 1_000_000, START_TS + 100);
    set_time(&mut env.svm, START_TS + 200);
    // Attacker tries to redirect the reclaimed vault rent to themselves.
    let stranger = env.stranger.pubkey();
    let freelancer_ata = env.freelancer_ata.pubkey();
    let ix = ix_claim(&env, &escrow, &vault, &stranger, &freelancer_ata);
    let logs = send_expect_err(&mut env.svm, &[ix], &[&env.freelancer]);
    assert_custom_err(&logs, E_UNAUTHORIZED);
}

#[test]
fn reject_unauthorized_dispute() {
    let mut env = setup();
    let (escrow, _) = create_escrow(&mut env, 19, 1_000_000, START_TS + 3600);
    let ix = ix_dispute(&escrow, &env.stranger.pubkey());
    let logs = send_expect_err(&mut env.svm, &[ix], &[&env.stranger]);
    assert_custom_err(&logs, E_UNAUTHORIZED);
}

#[test]
fn dispute_resolve_to_freelancer() {
    let mut env = setup();
    let amount = 3_000_000u64;
    let (escrow, vault) = create_escrow(&mut env, 20, amount, START_TS + 3600);

    // Client raises the dispute...
    send(
        &mut env.svm,
        &[ix_dispute(&escrow, &env.client.pubkey())],
        &[&env.client],
    );
    assert_eq!(escrow_status(&env.svm, &escrow), S_DISPUTED);

    // ...arbiter rules for the freelancer.
    let resolve_ix = ix_resolve(&env, &escrow, &vault, true);
    send(&mut env.svm, &[resolve_ix], &[&env.arbiter]);
    assert_eq!(escrow_status(&env.svm, &escrow), S_RESOLVED);
    assert_eq!(token_balance(&env.svm, &env.freelancer_ata.pubkey()), amount);
    assert!(!account_exists(&env.svm, &vault));
}

#[test]
fn dispute_resolve_to_client() {
    let mut env = setup();
    let amount = 3_000_000u64;
    let (escrow, vault) = create_escrow(&mut env, 21, amount, START_TS + 3600);

    // Freelancer raises the dispute...
    send(
        &mut env.svm,
        &[ix_dispute(&escrow, &env.freelancer.pubkey())],
        &[&env.freelancer],
    );
    assert_eq!(escrow_status(&env.svm, &escrow), S_DISPUTED);

    // ...arbiter refunds the client.
    let resolve_ix = ix_resolve(&env, &escrow, &vault, false);
    send(&mut env.svm, &[resolve_ix], &[&env.arbiter]);
    assert_eq!(escrow_status(&env.svm, &escrow), S_RESOLVED);
    assert_eq!(
        token_balance(&env.svm, &env.client_ata.pubkey()),
        1_000_000_000
    );
    assert!(!account_exists(&env.svm, &vault));
}

#[test]
fn reject_dispute_after_release() {
    let mut env = setup();
    let (escrow, vault) = create_escrow(&mut env, 22, 1_000_000, START_TS + 3600);
    send(
        &mut env.svm,
        &[ix_deliver(&escrow, &env.freelancer.pubkey())],
        &[&env.freelancer],
    );
    let freelancer_ata = env.freelancer_ata.pubkey();
    let pay_ix = ix_release(&env, &escrow, &vault, &freelancer_ata);
    send(&mut env.svm, &[pay_ix], &[&env.client]);
    let ix = ix_dispute(&escrow, &env.client.pubkey());
    let logs = send_expect_err(&mut env.svm, &[ix], &[&env.client]);
    assert_custom_err(&logs, E_INVALID_STATUS);
}
