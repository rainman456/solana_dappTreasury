use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
pub struct CancelPayout<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(
        seeds = [USER_SEED, authority.key().as_ref(), treasury.key().as_ref()],
        bump = user.bump,
        constraint = user.is_active @ ErrorCode::UnauthorizedUser,
        constraint = user.has_permission(Role::Treasurer) @ ErrorCode::UnauthorizedUser
    )]
    pub user: Account<'info, TreasuryUser>,
    
    #[account(
        seeds = [RECIPIENT_SEED, recipient.recipient.as_ref(), treasury.key().as_ref()],
        bump = recipient.bump
    )]
    pub recipient: Account<'info, WhitelistedRecipient>,
    
    #[account(
        mut,
        seeds = [
            PAYOUT_SEED, 
            recipient.recipient.as_ref(), 
            treasury.key().as_ref(),
            &payout_schedule.index.to_le_bytes()
        ],
        bump = payout_schedule.bump,
        constraint = payout_schedule.is_active @ ErrorCode::PayoutNotActive
    )]
    pub payout_schedule: Account<'info, PayoutSchedule>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CancelPayout>,
) -> Result<()> {
    let payout_schedule = &mut ctx.accounts.payout_schedule;
    let treasury = &ctx.accounts.treasury;
    
    // Deactivate the payout schedule
    payout_schedule.is_active = false;
    
    // Create audit log
    emit!(TreasuryEvent {
        action: AuditAction::CancelPayout as u8,
        treasury: treasury.key(),
        initiator: ctx.accounts.authority.key(),
        target: Some(ctx.accounts.recipient.recipient),
        amount: payout_schedule.amount,
        timestamp: Clock::get()?.unix_timestamp,
        token_mint: payout_schedule.token_mint, // Use the token mint from the payout schedule
    });
    
    Ok(())
}