use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
pub struct AddWhitelistedRecipient<'info> {
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
        constraint = user.has_permission(Role::Admin) @ ErrorCode::UnauthorizedUser
    )]
    pub user: Account<'info, TreasuryUser>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + WhitelistedRecipient::INIT_SPACE,
        seeds = [RECIPIENT_SEED, recipient.key().as_ref(), treasury.key().as_ref()],
        bump
    )]
    pub recipient_account: Account<'info, WhitelistedRecipient>,
    
    /// CHECK: This is just a pubkey that will be stored
    pub recipient: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AddWhitelistedRecipient>,
    name: String,
) -> Result<()> {
    // Validate name length
    require!(name.len() <= 32, ErrorCode::InvalidRole);
    
    let recipient_account = &mut ctx.accounts.recipient_account;
    let treasury = &ctx.accounts.treasury;
    
    // Initialize recipient account
    recipient_account.recipient = ctx.accounts.recipient.key();
    recipient_account.name = name;
    recipient_account.is_active = true;
    recipient_account.treasury = treasury.key();
    recipient_account.bump = ctx.bumps.recipient_account;
    
    // Create audit log
    emit!(TreasuryEvent {
        action: AuditAction::AddRecipient as u8,
        treasury: treasury.key(),
        initiator: ctx.accounts.authority.key(),
        target: Some(ctx.accounts.recipient.key()),
        amount: 0,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}