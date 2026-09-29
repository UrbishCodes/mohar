use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// TODO: replace with the real program id after `anchor keys` generates a keypair.
declare_id!("Ey5QSYnyD4GokFS3H8hiwMyrRVZEbzXnjaRPY6DdAtMQ");

#[program]
pub mod mohar {
    use super::*;

    /// Client creates an escrow and locks `amount` of SPL tokens (e.g. USDC)
    /// in the vault. The freelancer and an arbiter are named up front.
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        seed: u64,
        amount: u64,
        deadline: i64,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(
            deadline > Clock::get()?.unix_timestamp,
            EscrowError::InvalidDeadline
        );

        let escrow = &mut ctx.accounts.escrow;
        escrow.client = ctx.accounts.client.key();
        escrow.freelancer = ctx.accounts.freelancer.key();
        escrow.arbiter = ctx.accounts.arbiter.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.seed = seed;
        escrow.amount = amount;
        escrow.deadline = deadline;
        escrow.status = EscrowStatus::Funded;
        escrow.bump = ctx.bumps.escrow;
        escrow.vault_bump = ctx.bumps.vault;

        // Move tokens: client -> vault (vault is owned by the escrow PDA).
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.client_ata.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.client.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        emit!(EscrowCreated {
            escrow: escrow.key(),
            client: escrow.client,
            freelancer: escrow.freelancer,
            amount,
            deadline,
        });
        Ok(())
    }

    /// Freelancer signals the work is done. Funds stay locked until the
    /// client releases them (or the deadline passes).
    pub fn mark_delivered(ctx: Context<MarkDelivered>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidStatus
        );
        escrow.status = EscrowStatus::Delivered;
        emit!(EscrowDelivered { escrow: escrow.key() });
        Ok(())
    }

    /// Client approves the delivery: vault pays the freelancer in full.
    pub fn release(ctx: Context<Release>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Delivered,
            EscrowError::InvalidStatus
        );
        pay_out(
            &ctx.accounts.escrow,
            &ctx.accounts.vault,
            ctx.accounts.client.to_account_info(),
            ctx.accounts.freelancer_ata.to_account_info(),
            &ctx.accounts.token_program,
        )?;
        ctx.accounts.escrow.status = EscrowStatus::Released;
        let escrow = &ctx.accounts.escrow;
        emit!(EscrowReleased {
            escrow: escrow.key(),
            to: escrow.freelancer,
            amount: escrow.amount,
        });
        Ok(())
    }

    /// Client cancels before any delivery: full refund to the client.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidStatus
        );
        pay_out(
            &ctx.accounts.escrow,
            &ctx.accounts.vault,
            ctx.accounts.client.to_account_info(),
            ctx.accounts.client_ata.to_account_info(),
            &ctx.accounts.token_program,
        )?;
        ctx.accounts.escrow.status = EscrowStatus::Refunded;
        let escrow = &ctx.accounts.escrow;
        emit!(EscrowRefunded {
            escrow: escrow.key(),
            amount: escrow.amount,
        });
        Ok(())
    }

    /// If the client ghosts after delivery, the freelancer can claim the
    /// funds once the deadline has passed. No more "I'll pay next week".
    pub fn claim_after_deadline(ctx: Context<ClaimAfterDeadline>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Funded
                || ctx.accounts.escrow.status == EscrowStatus::Delivered,
            EscrowError::InvalidStatus
        );
        require!(
            Clock::get()?.unix_timestamp >= ctx.accounts.escrow.deadline,
            EscrowError::DeadlineNotReached
        );
        pay_out(
            &ctx.accounts.escrow,
            &ctx.accounts.vault,
            ctx.accounts.client.to_account_info(),
            ctx.accounts.freelancer_ata.to_account_info(),
            &ctx.accounts.token_program,
        )?;
        ctx.accounts.escrow.status = EscrowStatus::Released;
        let escrow = &ctx.accounts.escrow;
        emit!(EscrowReleased {
            escrow: escrow.key(),
            to: escrow.freelancer,
            amount: escrow.amount,
        });
        Ok(())
    }

    /// Either side can escalate to the arbiter while funds are locked.
    pub fn raise_dispute(ctx: Context<RaiseDispute>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.status == EscrowStatus::Funded
                || escrow.status == EscrowStatus::Delivered,
            EscrowError::InvalidStatus
        );
        // Only the two parties to the deal can escalate — no griefing by strangers.
        require!(
            ctx.accounts.authority.key() == escrow.client
                || ctx.accounts.authority.key() == escrow.freelancer,
            EscrowError::Unauthorized
        );
        escrow.status = EscrowStatus::Disputed;
        emit!(DisputeRaised {
            escrow: escrow.key(),
            by: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    /// Arbiter rules: true pays the freelancer, false refunds the client.
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        pay_freelancer: bool,
    ) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Disputed,
            EscrowError::InvalidStatus
        );
        let recipient = if pay_freelancer {
            ctx.accounts.freelancer_ata.to_account_info()
        } else {
            ctx.accounts.client_ata.to_account_info()
        };
        pay_out(
            &ctx.accounts.escrow,
            &ctx.accounts.vault,
            ctx.accounts.client.to_account_info(),
            recipient,
            &ctx.accounts.token_program,
        )?;
        ctx.accounts.escrow.status = EscrowStatus::Resolved;
        emit!(DisputeResolved {
            escrow: ctx.accounts.escrow.key(),
            pay_freelancer,
            amount: ctx.accounts.escrow.amount,
        });
        Ok(())
    }
}

/// Shared payout logic: transfer the full vault balance to `destination`,
/// signing as the escrow PDA, then close the vault (rent goes to `rent_to`).
fn pay_out<'info>(
    escrow: &Account<'info, Escrow>,
    vault: &Account<'info, TokenAccount>,
    rent_to: AccountInfo<'info>,
    destination: AccountInfo<'info>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    let seeds: &[&[u8]] = &[
        b"escrow",
        escrow.client.as_ref(),
        &escrow.seed.to_le_bytes(),
        &[escrow.bump],
    ];
    let signer = &[seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        token_program.to_account_info(),
        Transfer {
            from: vault.to_account_info(),
            to: destination,
            authority: escrow.to_account_info(),
        },
        signer,
    );
    token::transfer(cpi_ctx, escrow.amount)?;

    // Close the vault back to the client to reclaim rent.
    let close_ctx = CpiContext::new_with_signer(
        token_program.to_account_info(),
        anchor_spl::token::CloseAccount {
            account: vault.to_account_info(),
            destination: rent_to,
            authority: escrow.to_account_info(),
        },
        signer,
    );
    anchor_spl::token::close_account(close_ctx)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    /// CHECK: freelancer is only recorded; they never sign here.
    pub freelancer: UncheckedAccount<'info>,

    /// CHECK: arbiter is only recorded; they sign at resolve time.
    pub arbiter: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = client,
        space = Escrow::LEN,
        seeds = [b"escrow", client.key().as_ref(), &seed.to_le_bytes()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = client,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = escrow,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = client,
    )]
    pub client_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarkDelivered<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), &escrow.seed.to_le_bytes()],
        bump = escrow.bump,
        has_one = freelancer,
    )]
    pub escrow: Account<'info, Escrow>,
    pub freelancer: Signer<'info>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), &escrow.seed.to_le_bytes()],
        bump = escrow.bump,
        has_one = client,
    )]
    pub escrow: Account<'info, Escrow>,
    pub client: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = escrow.mint,
        constraint = freelancer_ata.owner == escrow.freelancer @ EscrowError::InvalidDestination,
    )]
    pub freelancer_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), &escrow.seed.to_le_bytes()],
        bump = escrow.bump,
        has_one = client,
    )]
    pub escrow: Account<'info, Escrow>,
    pub client: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = escrow.mint,
        constraint = client_ata.owner == escrow.client @ EscrowError::InvalidDestination,
    )]
    pub client_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimAfterDeadline<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), &escrow.seed.to_le_bytes()],
        bump = escrow.bump,
        has_one = freelancer,
    )]
    pub escrow: Account<'info, Escrow>,
    pub freelancer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: client receives the reclaimed vault rent; must match the recorded client.
    #[account(
        mut,
        constraint = client.key() == escrow.client @ EscrowError::Unauthorized
    )]
    pub client: UncheckedAccount<'info>,

    #[account(
        mut,
        token::mint = escrow.mint,
        constraint = freelancer_ata.owner == escrow.freelancer @ EscrowError::InvalidDestination,
    )]
    pub freelancer_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), &escrow.seed.to_le_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.client.as_ref(), &escrow.seed.to_le_bytes()],
        bump = escrow.bump,
        has_one = arbiter,
    )]
    pub escrow: Account<'info, Escrow>,
    pub arbiter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: client receives reclaimed vault rent and is a possible payout recipient;
    /// must match the recorded client.
    #[account(
        mut,
        constraint = client.key() == escrow.client @ EscrowError::Unauthorized
    )]
    pub client: UncheckedAccount<'info>,

    #[account(
        mut,
        token::mint = escrow.mint,
        constraint = freelancer_ata.owner == escrow.freelancer @ EscrowError::InvalidDestination,
    )]
    pub freelancer_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = escrow.mint,
        constraint = client_ata.owner == escrow.client @ EscrowError::InvalidDestination,
    )]
    pub client_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
pub struct Escrow {
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub arbiter: Pubkey,
    pub mint: Pubkey,
    pub seed: u64,
    pub amount: u64,
    pub deadline: i64,
    pub status: EscrowStatus,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Escrow {
    pub const LEN: usize = 8 + 32 * 4 + 8 + 8 + 8 + 1 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum EscrowStatus {
    Funded,
    Delivered,
    Released,
    Refunded,
    Disputed,
    Resolved,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct EscrowCreated {
    pub escrow: Pubkey,
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub amount: u64,
    pub deadline: i64,
}

#[event]
pub struct EscrowDelivered {
    pub escrow: Pubkey,
}

#[event]
pub struct EscrowReleased {
    pub escrow: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowRefunded {
    pub escrow: Pubkey,
    pub amount: u64,
}

#[event]
pub struct DisputeRaised {
    pub escrow: Pubkey,
    pub by: Pubkey,
}

#[event]
pub struct DisputeResolved {
    pub escrow: Pubkey,
    pub pay_freelancer: bool,
    pub amount: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum EscrowError {
    #[msg("Escrow amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Deadline must be in the future.")]
    InvalidDeadline,
    #[msg("Escrow is not in the right state for this action.")]
    InvalidStatus,
    #[msg("The deadline has not been reached yet.")]
    DeadlineNotReached,
    #[msg("Only the client or freelancer can perform this action.")]
    Unauthorized,
    #[msg("Token destination is not owned by the intended recipient.")]
    InvalidDestination,
}
