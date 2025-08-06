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
pub struct RemoveTreasurer<'info> {
    #[account(
        seeds = [
            b"treasury",
            mint.as_ref(),
        ],
        bump,
        constraint = treasury.admin == admin.key() @ TreasuryVaultError::InvalidAdmin,
    )]
    pub treasury: Account<'info, Treasury>,

    pub admin: Signer<'info>,

    #[account(
        mut,
        close=admin,
        seeds = [
            b"role",
            treasury.key().as_ref(),
            user.as_ref(),
        ],
        bump,
        constraint = user_role.is_treasurer @ TreasuryVaultError::InvalidTreasurer,
    )]
    pub user_role: Account<'info, UserRole>,
}

/// Accounts:
/// 0. `[]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
/// 2. `[writable]` user_role: [UserRole] 
///
/// Data:
/// - user: [Pubkey] User to remove treasurer role from
/// - mint: [Option<Pubkey>] 
pub fn handler(
    ctx: Context<RemoveTreasurer>,
    user: Pubkey,
    mint: Option<Pubkey>,
) -> Result<()> {
    // Verify the signer is the admin
    if ctx.accounts.treasury.admin != ctx.accounts.admin.key() {
        return err!(TreasuryVaultError::InvalidAdmin);
    }
    
    // Verify the user has the treasurer role
    if !ctx.accounts.user_role.is_treasurer {
        return err!(TreasuryVaultError::InvalidTreasurer);
    }
    
    // The account will be closed automatically due to the close=admin constraint
    msg!("Treasurer role removed for user: {}", user);
    
    Ok(())
}