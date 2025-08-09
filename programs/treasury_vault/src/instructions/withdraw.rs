use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
#[instruction(amount: u64, timestamp: i64)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + AuditLog::INIT_SPACE,
        seeds = [
            AUDIT_SEED,
            treasury.key().as_ref(),
            &timestamp.to_le_bytes(),
            authority.key().as_ref()
        ],
        bump
    )]
    pub audit_log: Account<'info, AuditLog>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [USER_SEED, authority.key().as_ref(), treasury.key().as_ref()],
        bump = user.bump,
        constraint = user.is_active @ ErrorCode::UnauthorizedUser,
        constraint = user.has_permission(Role::Treasurer) @ ErrorCode::UnauthorizedWithdrawal
    )]
    pub user: Account<'info, TreasuryUser>,
    
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

/// Allow authorized users to withdraw funds from the treasury
///
/// Accounts:
/// 0. `[writable]` treasury: The treasury account
/// 1. `[writable]` audit_log: The audit log account to create
/// 2. `[writable, signer]` authority: The user initiating the withdrawal
/// 3. `[readable]` user: The treasury user account of the authority
/// 4. `[writable]` recipient: The account receiving the withdrawn SOL
/// 5. `[]` system_program: System program for transfers and account creation
///
/// Data:
/// - amount: [u64] The amount of SOL to withdraw in lamports
/// - timestamp: [i64] The current timestamp
pub fn handler(
    ctx: Context<Withdraw>,
    amount: u64,
    timestamp: i64,
) -> Result<()> {
    // Validate inputs
    require!(amount > 0, ErrorCode::InvalidWithdrawAmount);
    
    // Validate timestamp is current or in the past
    let current_time = Clock::get()?.unix_timestamp;
    require!(timestamp <= current_time, ErrorCode::InvalidTimestamp);

    // Store treasury key for later use
    let treasury_key = ctx.accounts.treasury.key();
    
    // Check if treasury has enough funds
    require!(
        ctx.accounts.treasury.total_funds >= amount,
        ErrorCode::InsufficientFunds
    );

    // Check if we need to reset the epoch
    let treasury = &mut ctx.accounts.treasury;
    if current_time - treasury.last_epoch_start > treasury.epoch_duration as i64 {
        treasury.last_epoch_start = current_time;
        treasury.epoch_spending = 0;
    }

    // Check if withdrawal would exceed spending limit for the current epoch
    let new_epoch_spending = treasury.epoch_spending.checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
        
    require!(
        new_epoch_spending <= treasury.spending_limit,
        ErrorCode::SpendingLimitExceeded
    );

    // Update treasury state
    treasury.total_funds = treasury.total_funds.checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    treasury.epoch_spending = new_epoch_spending;

    // Transfer SOL from treasury to recipient
    // For PDA accounts, we need to use a different approach
    let treasury_info = ctx.accounts.treasury.to_account_info();
    let recipient_info = ctx.accounts.recipient.to_account_info();
    
    // Get the starting lamports
    let treasury_lamports = treasury_info.lamports();
    let recipient_lamports = recipient_info.lamports();
    
    // Ensure treasury has enough lamports
    require!(
        treasury_lamports >= amount,
        ErrorCode::InsufficientFunds
    );
    
    // Transfer lamports (native SOL) from treasury to recipient
    **treasury_info.try_borrow_mut_lamports()? = treasury_lamports.checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    **recipient_info.try_borrow_mut_lamports()? = recipient_lamports.checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    // Create audit log entry
    let audit_log = &mut ctx.accounts.audit_log;
    audit_log.action = AuditAction::Withdraw as u8;
    audit_log.initiator = ctx.accounts.authority.key();
    audit_log.amount = amount;
    audit_log.timestamp = timestamp;
    audit_log.bump = ctx.bumps.audit_log;

    // Emit event
    emit!(WithdrawEvent {
        admin: ctx.accounts.authority.key(),
        recipient: ctx.accounts.recipient.key(),
        amount,
        timestamp,
    });
    
    // Also emit the new treasury event for better tracking
    emit!(TreasuryEvent {
        action: AuditAction::Withdraw as u8,
        treasury: treasury_key,
        initiator: ctx.accounts.authority.key(),
        target: Some(ctx.accounts.recipient.key()),
        amount,
        timestamp,
    });

    Ok(())
}