use crate::*;
use anchor_lang::prelude::*;
use crate::error::TreasuryVaultError;

#[derive(Accounts)]
#[instruction(
    recipient: Pubkey,
    mint: Option<Pubkey>,
    amount: u64,
    scheduled_time: i64,
    recurring: bool,
    recurrence_interval: Option<i64>,
    recurrence_end_time: Option<i64>,
    id: u64,
)]
pub struct SchedulePayout<'info> {
    #[account(
        seeds = [
            b"treasury",
            mint.as_ref().map(|m| m.as_ref()).unwrap_or(&Pubkey::default().to_bytes()),
        ],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        init,
        space=117,
        payer=authority,
        seeds = [
            b"payout",
            treasury.key().as_ref(),
            recipient.as_ref(),
            id.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub payout: Account<'info, Payout>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    
    // Optional whitelist account to check if recipient is whitelisted
    #[account(
        seeds = [
            b"whitelist",
            treasury.key().as_ref(),
            recipient.as_ref(),
        ],
        bump,
        seeds::program = crate::ID,
        constraint = whitelist.recipient == recipient @ TreasuryVaultError::RecipientNotWhitelisted,
    )]
    pub whitelist: Option<Account<'info, WhitelistedRecipient>>,
    
    // Optional user role account to check if authority is treasurer
    #[account(
        seeds = [
            b"role",
            treasury.key().as_ref(),
            authority.key().as_ref(),
        ],
        bump,
        seeds::program = crate::ID,
    )]
    pub user_role: Option<Account<'info, UserRole>>,
}

/// Accounts:
/// 0. `[]` treasury: [Treasury] 
/// 1. `[writable]` payout: [Payout] 
/// 2. `[signer]` authority: [AccountInfo] Must be admin or treasurer
/// 3. `[]` system_program: [AccountInfo] Auto-generated, for account initialization
///
/// Data:
/// - recipient: [Pubkey] The recipient of the payout
/// - mint: [Option<Pubkey>] 
/// - amount: [u64] The amount to be paid out
/// - scheduled_time: [i64] The time when the payout is scheduled
/// - recurring: [bool] Whether this is a recurring payout
/// - recurrence_interval: [Option<i64>] Interval for recurring payouts in seconds
/// - recurrence_end_time: [Option<i64>] End time for recurring payouts
/// - id: [u64] Unique identifier for this payout
pub fn handler(
    ctx: Context<SchedulePayout>,
    recipient: Pubkey,
    mint: Option<Pubkey>,
    amount: u64,
    scheduled_time: i64,
    recurring: bool,
    recurrence_interval: Option<i64>,
    recurrence_end_time: Option<i64>,
    id: u64,
) -> Result<()> {
    // Verify authority is admin or treasurer
    let is_admin = ctx.accounts.treasury.admin == ctx.accounts.authority.key();
    let is_treasurer = if let Some(user_role) = &ctx.accounts.user_role {
        user_role.is_treasurer
    } else {
        false
    };
    
    if !is_admin && !is_treasurer {
        return err!(TreasuryVaultError::InvalidAdmin);
    }
    
    // Validate amount
    if amount == 0 {
        return err!(TreasuryVaultError::InsufficientFunds);
    }
    
    // Validate scheduled time
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;
    
    if scheduled_time < current_time {
        msg!("Warning: Scheduled time is in the past");
    }
    
    // Validate recurrence parameters
    if recurring {
        if recurrence_interval.is_none() || recurrence_interval.unwrap() <= 0 {
            msg!("Warning: Recurring payout set without valid interval");
        }
        
        if let Some(end_time) = recurrence_end_time {
            if end_time <= scheduled_time {
                msg!("Warning: Recurrence end time is before or equal to start time");
            }
        }
    }
    
    // Initialize payout account
    let payout = &mut ctx.accounts.payout;
    payout.treasury = ctx.accounts.treasury.key();
    payout.recipient = recipient;
    payout.amount = amount;
    payout.scheduled_time = scheduled_time;
    payout.executed = false;
    payout.recurring = recurring;
    payout.recurrence_interval = recurrence_interval;
    payout.recurrence_end_time = recurrence_end_time;
    payout.id = id;
    payout.bump = ctx.bumps.payout;
    
    msg!("Payout scheduled for recipient: {}", recipient);
    msg!("Amount: {}", amount);
    msg!("Scheduled time: {}", scheduled_time);
    if recurring {
        msg!("Recurring: Yes, with interval: {:?}", recurrence_interval);
        if let Some(end_time) = recurrence_end_time {
            msg!("Recurrence end time: {}", end_time);
        }
    }
    
    Ok(())
}