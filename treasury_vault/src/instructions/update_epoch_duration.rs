use crate::*;
use anchor_lang::prelude::*;
use crate::error::TreasuryVaultError;

#[derive(Accounts)]
#[instruction(
    new_epoch_duration: i64,
    mint: Option<Pubkey>,
)]
pub struct UpdateEpochDuration<'info> {
    #[account(
        mut,
        seeds = [
            b"treasury",
            mint.as_ref().map(|m| m.as_ref()).unwrap_or(&Pubkey::default().to_bytes()),
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
/// - new_epoch_duration: [i64] New epoch duration in seconds
/// - mint: [Option<Pubkey>] 
pub fn handler(
    ctx: Context<UpdateEpochDuration>,
    new_epoch_duration: i64,
    mint: Option<Pubkey>,
) -> Result<()> {
    // Verify the signer is the admin
    if ctx.accounts.treasury.admin != ctx.accounts.admin.key() {
        return err!(TreasuryVaultError::InvalidAdmin);
    }
    
    // Validate new epoch duration
    if new_epoch_duration <= 0 {
        return err!(TreasuryVaultError::InvalidEpochDuration);
    }
    
    // Get the current timestamp
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;
    
    // Update the epoch duration and reset the epoch start time
    let treasury = &mut ctx.accounts.treasury;
    let old_duration = treasury.epoch_duration;
    treasury.epoch_duration = new_epoch_duration;
    
    // Reset the epoch start time to the current time
    treasury.epoch_start_time = current_time;
    
    // Reset the current epoch spending since we're starting a new epoch
    treasury.current_epoch_spending = 0;
    
    msg!("Epoch duration updated from {} to {} seconds", old_duration, new_epoch_duration);
    msg!("New epoch started at {}", current_time);
    
    Ok(())
}