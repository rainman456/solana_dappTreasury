use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
pub struct ExecutePayout<'info> {
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
        constraint = user.has_permission(Role::Treasurer) @ ErrorCode::UnauthorizedUser
    )]
    pub user: Account<'info, TreasuryUser>,
    
    #[account(
        seeds = [RECIPIENT_SEED, recipient.recipient.as_ref(), treasury.key().as_ref()],
        bump = recipient.bump,
        constraint = recipient.is_active @ ErrorCode::RecipientNotActive
    )]
    pub recipient: Account<'info, WhitelistedRecipient>,
    
    #[account(
        mut,
        seeds = [
            PAYOUT_SEED, 
            recipient.recipient.as_ref(), 
            treasury.key().as_ref(),
            &payout_schedule.index.to_le_bytes()
        ],
        bump = payout_schedule.bump,
        constraint = payout_schedule.is_active @ ErrorCode::PayoutNotActive
    )]
    pub payout_schedule: Account<'info, PayoutSchedule>,
    
    /// CHECK: This is the recipient's wallet that will receive the funds
    #[account(
        mut,
        constraint = recipient_wallet.key() == recipient.recipient @ ErrorCode::RecipientNotWhitelisted
    )]
    pub recipient_wallet: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ExecutePayout>,
    timestamp: i64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    
    // Validate timestamp
    require!(timestamp <= current_time, ErrorCode::InvalidTimestamp);
    
    let payout_schedule = &mut ctx.accounts.payout_schedule;
    
    // Check if payout is due
    require!(payout_schedule.is_due(current_time), ErrorCode::PayoutNotDue);
    
    // For one-time payouts, check if it's already been executed
    if !payout_schedule.recurring && payout_schedule.last_executed > 0 {
        return Err(ErrorCode::PayoutAlreadyExecuted.into());
    }
    
    // Get treasury data before mutable borrow
    let treasury_key = ctx.accounts.treasury.key();
    let treasury_bump = ctx.accounts.treasury.bump;
    let payout_amount = payout_schedule.amount;
    
    // Check if treasury has enough funds
    require!(
        ctx.accounts.treasury.total_funds >= payout_amount,
        ErrorCode::InsufficientFunds
    );
    
    // Check if this would exceed the spending limit for the current epoch
    let treasury = &mut ctx.accounts.treasury;
    let current_epoch_start = if current_time >= treasury.last_epoch_start + treasury.epoch_duration as i64 {
        // We're in a new epoch, reset the epoch_spending
        treasury.epoch_spending = 0;
        current_time
    } else {
        treasury.last_epoch_start
    };
    
    // Update treasury's epoch data
    treasury.last_epoch_start = current_epoch_start;
    
    // Check if this withdrawal would exceed the spending limit
    let new_epoch_spending = treasury
        .epoch_spending
        .checked_add(payout_amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
        
    require!(
        new_epoch_spending <= treasury.spending_limit,
        ErrorCode::SpendingLimitExceeded
    );
    
    // Update treasury state
    treasury.epoch_spending = new_epoch_spending;
    treasury.total_funds = treasury
        .total_funds
        .checked_sub(payout_amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    // Transfer funds to recipient
    let treasury_seeds = &[
        TREASURY_SEED,
        &[treasury_bump],
    ];
    let treasury_signer = &[&treasury_seeds[..]];
    
    // Transfer lamports from treasury to recipient
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.recipient_wallet.to_account_info(),
            },
            treasury_signer,
        ),
        payout_amount,
    )?;
    
    // Update payout schedule
    payout_schedule.last_executed = current_time;
    
    // If it's a one-time payout, deactivate it
    if !payout_schedule.recurring {
        payout_schedule.is_active = false;
    }
    
    // Create audit log
    emit!(TreasuryEvent {
        action: AuditAction::ExecutePayout as u8,
        treasury: treasury_key,
        initiator: ctx.accounts.authority.key(),
        target: Some(ctx.accounts.recipient.recipient),
        amount: payout_amount,
        timestamp: current_time,
    });
    
    Ok(())
}