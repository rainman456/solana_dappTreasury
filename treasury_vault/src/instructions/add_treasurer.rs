use crate::*;
use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction(
    user: Pubkey,
    mint: Option<Pubkey>,
)]
pub struct AddTreasurer<'info> {
    #[account(
        seeds = [
            b"treasury",
            mint.as_ref(),
        ],
        bump,
        constraint = treasury.admin == admin.key() @ TreasuryVaultError::InvalidAdmin,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        space=74,
        payer=admin,
        seeds = [
            b"role",
            treasury.key().as_ref(),
            user.as_ref(),
        ],
        bump,
    )]
    pub user_role: Account<'info, UserRole>,

    pub system_program: Program<'info, System>,
}

/// Accounts:
/// 0. `[]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
/// 2. `[writable]` user_role: [UserRole] 
/// 3. `[]` system_program: [AccountInfo] Auto-generated, for account initialization
///
/// Data:
/// - user: [Pubkey] User to be given treasurer role
/// - mint: [Option<Pubkey>] 
pub fn handler(
    ctx: Context<AddTreasurer>,
    user: Pubkey,
    mint: Option<Pubkey>,
) -> Result<()> {
    // Verify the signer is the admin
    if ctx.accounts.treasury.admin != ctx.accounts.admin.key() {
        return err!(TreasuryVaultError::InvalidAdmin);
    }
    
    // Initialize the user role account
    let user_role = &mut ctx.accounts.user_role;
    user_role.treasury = ctx.accounts.treasury.key();
    user_role.user = user;
    user_role.is_treasurer = true;
    user_role.bump = *ctx.bumps.get("user_role").unwrap();
    
    msg!("Treasurer role added for user: {}", user);
    
    Ok(())
}