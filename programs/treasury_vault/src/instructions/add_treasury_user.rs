use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
pub struct AddTreasuryUser<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump,
        constraint = treasury.admin == admin.key() @ ErrorCode::UnauthorizedUser
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + TreasuryUser::INIT_SPACE,
        seeds = [USER_SEED, user.key().as_ref(), treasury.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, TreasuryUser>,
    
    /// CHECK: This is just a pubkey that will be stored
    pub user: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AddTreasuryUser>,
    role: u8,
) -> Result<()> {
    // Validate role
    require!(
        role == Role::Admin as u8 || role == Role::Treasurer as u8,
        ErrorCode::InvalidRole
    );
    
    let user_account = &mut ctx.accounts.user_account;
    let treasury = &ctx.accounts.treasury;
    
    // Initialize user account
    user_account.user = ctx.accounts.user.key();
    user_account.role = role;
    user_account.is_active = true;
    user_account.treasury = treasury.key();
    user_account.bump = ctx.bumps.user_account;
    
    // Create audit log
    emit!(TreasuryEvent {
        action: AuditAction::AddUser as u8,
        treasury: treasury.key(),
        initiator: ctx.accounts.admin.key(),
        target: Some(ctx.accounts.user.key()),
        amount: 0,
        timestamp: Clock::get()?.unix_timestamp,
        token_mint: None, // Not token related
    });
    
    Ok(())
}