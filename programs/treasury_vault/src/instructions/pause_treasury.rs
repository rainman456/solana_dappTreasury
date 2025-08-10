use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
pub struct PauseTreasury<'info> {
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
        constraint = user.is_admin() @ ErrorCode::UnauthorizedPauseAction
    )]
    pub user: Account<'info, TreasuryUser>,
    
    pub system_program: Program<'info, System>,
}

/// Allow admin users to pause the treasury
///
/// Accounts:
/// 0. `[writable]` treasury: The treasury account
/// 1. `[writable, signer]` authority: The user initiating the pause
/// 2. `[readable]` user: The treasury user account of the authority
/// 3. `[]` system_program: System program
pub fn handler(
    ctx: Context<PauseTreasury>,
) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    
    // Check if treasury is already paused
    require!(!treasury.is_paused, ErrorCode::TreasuryAlreadyPaused);
    
    // Pause the treasury
    treasury.is_paused = true;
    
    // Get current timestamp
    let current_time = Clock::get()?.unix_timestamp;
    
    // Emit pause event
    emit!(TreasuryPausedEvent {
        admin: ctx.accounts.authority.key(),
        treasury: treasury.key(),
        timestamp: current_time,
    });
    
    // Also emit the treasury event for better tracking
    emit!(TreasuryEvent {
        action: AuditAction::PauseTreasury as u8,
        treasury: treasury.key(),
        initiator: ctx.accounts.authority.key(),
        target: None,
        amount: 0,
        timestamp: current_time,
        token_mint: None, // Not token related
    });

    Ok(())
}