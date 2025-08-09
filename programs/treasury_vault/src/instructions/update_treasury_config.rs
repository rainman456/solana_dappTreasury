use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
pub struct UpdateTreasuryConfig<'info> {
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [USER_SEED, authority.key().as_ref(), treasury.key().as_ref()],
        bump = user.bump,
        constraint = user.is_active @ ErrorCode::UnauthorizedUser,
        constraint = user.is_admin() @ ErrorCode::UnauthorizedConfigUpdate
    )]
    pub user: Account<'info, TreasuryUser>,
    
    pub system_program: Program<'info, System>,
}

/// Allow admin users to update treasury configuration
///
/// Accounts:
/// 0. `[writable]` treasury: The treasury account
/// 1. `[writable, signer]` authority: The user initiating the update
/// 2. `[readable]` user: The treasury user account of the authority
/// 3. `[]` system_program: System program
///
/// Data:
/// - epoch_duration: [Option<u64>] Optional new epoch duration
/// - spending_limit: [Option<u64>] Optional new spending limit
pub fn handler(
    ctx: Context<UpdateTreasuryConfig>,
    epoch_duration: Option<u64>,
    spending_limit: Option<u64>,
) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;

    // Update epoch duration if provided
    if let Some(duration) = epoch_duration {
        require!(duration > 0, ErrorCode::InvalidEpochDuration);
        treasury.epoch_duration = duration;
    }

    // Update spending limit if provided
    if let Some(limit) = spending_limit {
        require!(limit > 0, ErrorCode::InvalidSpendingLimit);
        treasury.spending_limit = limit;
    }

    // Emit event
    emit!(TreasuryConfigUpdatedEvent {
        admin: ctx.accounts.authority.key(),
        epoch_duration: treasury.epoch_duration,
        spending_limit: treasury.spending_limit,
    });
    
    // Also emit the new treasury event for better tracking
    emit!(TreasuryEvent {
        action: AuditAction::AddUser as u8, // Reusing AddUser as a ConfigUpdate action
        treasury: treasury.key(),
        initiator: ctx.accounts.authority.key(),
        target: None,
        amount: 0,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}