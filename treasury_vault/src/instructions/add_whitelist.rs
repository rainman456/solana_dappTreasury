use crate::*;
use anchor_lang::prelude::*;
use crate::error::TreasuryVaultError;

#[derive(Accounts)]
#[instruction(
    recipient: Pubkey,
    mint: Option<Pubkey>,
)]
pub struct AddWhitelist<'info> {
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
        space=73,
        payer=admin,
        seeds = [
            b"whitelist",
            treasury.key().as_ref(),
            recipient.as_ref(),
        ],
        bump,
    )]
    pub whitelist: Account<'info, WhitelistedRecipient>,

    pub system_program: Program<'info, System>,
}

/// Accounts:
/// 0. `[]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
/// 2. `[writable]` whitelist: [WhitelistedRecipient] 
/// 3. `[]` system_program: [AccountInfo] Auto-generated, for account initialization
///
/// Data:
/// - recipient: [Pubkey] Recipient to be whitelisted
/// - mint: [Option<Pubkey>] 
pub fn handler(
    ctx: Context<AddWhitelist>,
    recipient: Pubkey,
    mint: Option<Pubkey>,
) -> Result<()> {
    // Verify the signer is the admin
    if ctx.accounts.treasury.admin != ctx.accounts.admin.key() {
        return err!(TreasuryVaultError::InvalidAdmin);
    }
    
    // Initialize the whitelist account
    let whitelist = &mut ctx.accounts.whitelist;
    whitelist.treasury = ctx.accounts.treasury.key();
    whitelist.recipient = recipient;
    whitelist.bump = *ctx.bumps.get("whitelist").unwrap();
    
    msg!("Recipient added to whitelist: {}", recipient);
    
    Ok(())
}