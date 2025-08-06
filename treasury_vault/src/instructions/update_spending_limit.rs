use crate::*;
use anchor_lang::prelude::*;
use crate::error::TreasuryVaultError;

#[derive(Accounts)]
#[instruction(
    new_spending_limit: u64,
    mint: Option<Pubkey>,
)]
pub struct UpdateSpendingLimit<'info> {
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
/// 1. `[signer]` admin: [AccountInfo] 
///
/// Data:
/// - new_spending_limit: [u64] New spending limit per epoch
/// - mint: [Option<Pubkey>] 
pub fn handler(
    ctx: Context<UpdateSpendingLimit>,
    new_spending_limit: u64,
    mint: Option<Pubkey>,
) -> Result<()> {
    // Verify the signer is the admin
    if ctx.accounts.treasury.admin != ctx.accounts.admin.key() {
        return err!(TreasuryVaultError::InvalidAdmin);
    }
    
    // Validate new spending limit
    if new_spending_limit == 0 {
        return err!(TreasuryVaultError::SpendingLimitExceeded);
    }
    
    // Update the spending limit
    let treasury = &mut ctx.accounts.treasury;
    let old_limit = treasury.spending_limit;
    treasury.spending_limit = new_spending_limit;
    
    msg!("Spending limit updated from {} to {}", old_limit, new_spending_limit);
    
    Ok(())
}