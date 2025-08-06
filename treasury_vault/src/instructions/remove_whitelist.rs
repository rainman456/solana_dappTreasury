use crate::*;
use anchor_lang::prelude::*;
use crate::error::TreasuryVaultError;

#[derive(Accounts)]
#[instruction(
    recipient: Pubkey,
    mint: Option<Pubkey>,
)]
pub struct RemoveWhitelist<'info> {
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
        mut,
        close=admin,
        seeds = [
            b"whitelist",
            treasury.key().as_ref(),
            recipient.as_ref(),
        ],
        bump,
        constraint = whitelist.recipient == recipient @ TreasuryVaultError::RecipientNotWhitelisted,
    )]
    pub whitelist: Account<'info, WhitelistedRecipient>,
}

/// Accounts:
/// 0. `[]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
/// 2. `[writable]` whitelist: [WhitelistedRecipient] 
///
/// Data:
/// - recipient: [Pubkey] Recipient to remove from whitelist
/// - mint: [Option<Pubkey>] 
pub fn handler(
    ctx: Context<RemoveWhitelist>,
    recipient: Pubkey,
    mint: Option<Pubkey>,
) -> Result<()> {
    // Verify the signer is the admin
    if ctx.accounts.treasury.admin != ctx.accounts.admin.key() {
        return err!(TreasuryVaultError::InvalidAdmin);
    }
    
    // Verify the recipient is whitelisted
    if ctx.accounts.whitelist.recipient != recipient {
        return err!(TreasuryVaultError::RecipientNotWhitelisted);
    }
    
    // The account will be closed automatically due to the close=admin constraint
    msg!("Recipient removed from whitelist: {}", recipient);
    
    Ok(())
}