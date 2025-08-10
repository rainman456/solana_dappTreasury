use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
pub struct SetTokenGate<'info> {
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
    
    /// CHECK: This is an optional token mint that will be stored
    pub token_mint: Option<UncheckedAccount<'info>>,
    
    pub system_program: Program<'info, System>,
}

/// Allow admin users to set a token gate for payouts
///
/// Accounts:
/// 0. `[writable]` treasury: The treasury account
/// 1. `[writable, signer]` authority: The user initiating the update
/// 2. `[readable]` user: The treasury user account of the authority
/// 3. `[optional]` token_mint: The token mint to use for gating (optional)
/// 4. `[]` system_program: System program
pub fn handler(
    ctx: Context<SetTokenGate>,
) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    
    // Update the token gate
    treasury.gate_token_mint = ctx.accounts.token_mint.as_ref().map(|mint| mint.key());
    
    // Get current timestamp
    let current_time = Clock::get()?.unix_timestamp;
    
    // Emit token gate set event
    emit!(TokenGateSetEvent {
        admin: ctx.accounts.authority.key(),
        treasury: treasury.key(),
        token_mint: treasury.gate_token_mint,
        timestamp: current_time,
    });
    
    // Also emit the treasury event for better tracking
    emit!(TreasuryEvent {
        action: AuditAction::TokenGateSet as u8,
        treasury: treasury.key(),
        initiator: ctx.accounts.authority.key(),
        target: treasury.gate_token_mint,
        amount: 0,
        timestamp: current_time,
        token_mint: treasury.gate_token_mint, // Use the gate token mint
    });

    Ok(())
}