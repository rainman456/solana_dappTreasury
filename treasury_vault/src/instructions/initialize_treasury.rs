use crate::*;
use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction(
    mint: Option<Pubkey>,
    epoch_duration: i64,
    spending_limit: u64,
    token_gated_mint: Option<Pubkey>,
)]
pub struct InitializeTreasury<'info> {
    pub admin: Signer<'info>,

    #[account(
        init,
        space=138,
        payer=admin,
        seeds = [
            b"treasury",
            mint.as_ref(),
        ],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    pub system_program: Program<'info, System>,
}

/// Accounts:
/// 0. `[signer]` admin: [AccountInfo] 
/// 1. `[writable]` treasury: [Treasury] 
/// 2. `[]` system_program: [AccountInfo] Auto-generated, for account initialization
///
/// Data:
/// - mint: [Option<Pubkey>] The token mint (null for SOL)
/// - epoch_duration: [i64] Duration of each epoch in seconds
/// - spending_limit: [u64] Maximum amount that can be spent in an epoch
/// - token_gated_mint: [Option<Pubkey>] Optional token mint for token-gated access
pub fn handler(
    ctx: Context<InitializeTreasury>,
    mint: Option<Pubkey>,
    epoch_duration: i64,
    spending_limit: u64,
    token_gated_mint: Option<Pubkey>,
) -> Result<()> {
    // Validate epoch duration is greater than zero
    if epoch_duration <= 0 {
        return err!(TreasuryVaultError::InvalidEpochDuration);
    }

    // Get the current timestamp
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Initialize the treasury account
    let treasury = &mut ctx.accounts.treasury;
    treasury.admin = ctx.accounts.admin.key();
    treasury.mint = mint.unwrap_or_else(|| Pubkey::default()); // Default to system program pubkey for SOL
    treasury.epoch_duration = epoch_duration;
    treasury.epoch_start_time = current_time;
    treasury.spending_limit = spending_limit;
    treasury.current_epoch_spending = 0;
    treasury.token_gated_mint = token_gated_mint;
    treasury.bump = *ctx.bumps.get("treasury").unwrap();

    msg!("Treasury initialized with admin: {}", treasury.admin);
    msg!("Epoch duration set to: {} seconds", epoch_duration);
    msg!("Spending limit set to: {}", spending_limit);
    
    Ok(())
}