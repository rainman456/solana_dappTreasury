use crate::*;
use anchor_lang::{
    prelude::*,
    system_program,
};
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(amount: u64, timestamp: i64)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(
        init,
        payer = depositor,
        space = 8 + AuditLog::INIT_SPACE,
        seeds = [
            b"audit",
            treasury.key().as_ref(),
            &timestamp.to_le_bytes(),
            depositor.key().as_ref()
        ],
        bump
    )]
    pub audit_log: Account<'info, AuditLog>,
    
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

/// Allow any user to deposit SOL into the treasury
///
/// Accounts:
/// 0. `[writable]` treasury: The treasury account
/// 1. `[writable]` audit_log: The audit log account to create
/// 2. `[writable, signer]` depositor: The account depositing SOL
/// 3. `[]` system_program: System program for transfers and account creation
///
/// Data:
/// - amount: [u64] The amount of SOL to deposit in lamports
/// - timestamp: [i64] The current timestamp
pub fn handler(
    ctx: Context<Deposit>,
    amount: u64,
    timestamp: i64,
) -> Result<()> {
    // Validate inputs
    require!(amount > 0, crate::error::ErrorCode::InvalidDepositAmount);
    
    // Validate timestamp is current or in the past
    let current_time = Clock::get()?.unix_timestamp;
    require!(timestamp <= current_time, crate::error::ErrorCode::InvalidTimestamp);

    // Transfer SOL from depositor to treasury
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, amount)?;

    // Update treasury total funds
    let treasury = &mut ctx.accounts.treasury;
    treasury.total_funds = treasury.total_funds.checked_add(amount)
        .ok_or(crate::error::ErrorCode::ArithmeticOverflow)?;

    // Create audit log entry
    let audit_log = &mut ctx.accounts.audit_log;
    audit_log.action = AuditAction::Deposit as u8;
    audit_log.initiator = ctx.accounts.depositor.key();
    audit_log.amount = amount;
    audit_log.timestamp = timestamp;
    audit_log.bump = ctx.bumps.audit_log;

    // Emit event
    emit!(DepositEvent {
        depositor: ctx.accounts.depositor.key(),
        amount,
        timestamp,
    });

    Ok(())
}