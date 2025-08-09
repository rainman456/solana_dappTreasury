use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + TreasuryUser::INIT_SPACE,
        seeds = [USER_SEED, admin.key().as_ref(), treasury.key().as_ref()],
        bump
    )]
    pub admin_user: Account<'info, TreasuryUser>,
    
    pub system_program: Program<'info, System>,
}

/// Initialize a treasury vault to store SOL with configurable parameters
///
/// Accounts:
/// 0. `[writable, signer]` admin: The admin of the treasury
/// 1. `[writable]` treasury: The treasury account to initialize
/// 2. `[writable]` admin_user: The admin user account
/// 3. `[]` system_program: System program for account creation
///
/// Data:
/// - epoch_duration: [u64] The duration of an epoch in seconds
/// - spending_limit: [u64] The spending limit per epoch in lamports
pub fn handler(
    ctx: Context<InitializeTreasury>,
    epoch_duration: u64,
    spending_limit: u64,
) -> Result<()> {
    // Validate inputs
    require!(epoch_duration > 0, ErrorCode::InvalidEpochDuration);
    require!(spending_limit > 0, ErrorCode::InvalidSpendingLimit);

    let treasury = &mut ctx.accounts.treasury;
    treasury.admin = ctx.accounts.admin.key();
    treasury.epoch_duration = epoch_duration;
    treasury.spending_limit = spending_limit;
    treasury.total_funds = 0;
    treasury.last_epoch_start = Clock::get()?.unix_timestamp;
    treasury.epoch_spending = 0;
    treasury.next_payout_index = 0;
    treasury.bump = ctx.bumps.treasury;
    
    // Initialize admin user
    let admin_user = &mut ctx.accounts.admin_user;
    admin_user.user = ctx.accounts.admin.key();
    admin_user.role = Role::Admin as u8;
    admin_user.is_active = true;
    admin_user.treasury = treasury.key();
    admin_user.bump = ctx.bumps.admin_user;

    // Emit event
    emit!(TreasuryInitializedEvent {
        admin: treasury.admin,
        epoch_duration,
        spending_limit,
    });

    Ok(())
}