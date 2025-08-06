use crate::*;
use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction(
    new_admin: Pubkey,
    mint: Option<Pubkey>,
)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        seeds = [
            b"treasury",
            mint.as_ref(),
        ],
        bump,
        constraint = treasury.admin == admin.key() @ TreasuryVaultError::InvalidAdmin,
    )]
    pub treasury: Account<'info, Treasury>,

    pub admin: Signer<'info>,
}

/// Accounts:
/// 0. `[writable]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] Current admin
///
/// Data:
/// - new_admin: [Pubkey] New admin address
/// - mint: [Option<Pubkey>] 
pub fn handler(
    ctx: Context<UpdateAdmin>,
    new_admin: Pubkey,
    mint: Option<Pubkey>,
) -> Result<()> {
    // Verify the signer is the current admin
    if ctx.accounts.treasury.admin != ctx.accounts.admin.key() {
        return err!(TreasuryVaultError::InvalidAdmin);
    }
    
    // Update the admin
    let treasury = &mut ctx.accounts.treasury;
    let old_admin = treasury.admin;
    treasury.admin = new_admin;
    
    msg!("Admin updated from {} to {}", old_admin, new_admin);
    
    Ok(())
}