use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token};

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
#[instruction(timestamp: i64)]
pub struct ExecuteTokenPayout<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump,
        constraint = !treasury.is_paused @ ErrorCode::TreasuryPaused
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
        constraint = payout_schedule.is_active @ ErrorCode::PayoutNotActive,
    )]
    pub payout_schedule: Account<'info, PayoutSchedule>,
    
    #[account(
        mut,
        seeds = [TOKEN_BALANCE_SEED, treasury.key().as_ref(), token_mint.key().as_ref()],
        bump,
    )]
    pub token_balance: Account<'info, TokenBalance>,
    
    /// CHECK: This is validated in the handler
    #[account(mut)]
    pub treasury_token_account: AccountInfo<'info>,
    
    /// CHECK: This is validated in the handler
    #[account(mut)]
    pub recipient_token_account: AccountInfo<'info>,
    
    /// CHECK: This is validated in the handler
    pub token_mint: AccountInfo<'info>,
    
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
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<ExecuteTokenPayout>,
    timestamp: i64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    
    // Validate timestamp
    require!(timestamp <= current_time, ErrorCode::InvalidTimestamp);
    
    let payout_schedule = &mut ctx.accounts.payout_schedule;
    
    // Validate payout schedule has token mint
    require!(payout_schedule.token_mint.is_some(), ErrorCode::InvalidTokenMint);
    let payout_token_mint = payout_schedule.token_mint.unwrap();
    let token_mint_key = ctx.accounts.token_mint.key();
    require!(payout_token_mint == token_mint_key, ErrorCode::InvalidTokenMint);
    
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
    
    // Validate token balance
    let token_balance = &mut ctx.accounts.token_balance;
    require!(token_balance.token_mint == token_mint_key, ErrorCode::InvalidTokenMint);
    require!(token_balance.balance >= payout_amount, ErrorCode::InsufficientTokenBalance);
    
    // Validate token accounts
    // Check treasury token account
    let treasury_token_account = &ctx.accounts.treasury_token_account;
    let treasury_token_account_data = token::TokenAccount::try_deserialize(&mut &treasury_token_account.data.borrow()[..])?;
    
    require!(
        treasury_token_account_data.owner == treasury_key,
        ErrorCode::InvalidTokenAccountOwner
    );
    
    require!(
        treasury_token_account_data.mint == token_mint_key,
        ErrorCode::InvalidTokenMint
    );
    
    // Check recipient token account
    let recipient_token_account = &ctx.accounts.recipient_token_account;
    let recipient_token_account_data = token::TokenAccount::try_deserialize(&mut &recipient_token_account.data.borrow()[..])?;
    
    require!(
        recipient_token_account_data.owner == ctx.accounts.recipient.recipient,
        ErrorCode::InvalidTokenAccountOwner
    );
    
    require!(
        recipient_token_account_data.mint == token_mint_key,
        ErrorCode::InvalidTokenMint
    );
    
    // Check if token gate is enabled and validate token ownership
    if let Some(gate_token_mint) = ctx.accounts.treasury.gate_token_mint {
        // Verify the recipient owns the token account and it's for the correct mint
        require!(
            recipient_token_account_data.mint == gate_token_mint &&
            recipient_token_account_data.amount > 0,
            ErrorCode::TokenGateCheckFailed
        );
    }
    
    // Check if this would exceed the spending limit for the current epoch
    let previous_epoch_spending = token_balance.epoch_spending;
    let current_epoch_start = if current_time >= ctx.accounts.treasury.last_epoch_start + ctx.accounts.treasury.epoch_duration as i64 {
        // We're in a new epoch, reset the epoch_spending
        token_balance.epoch_spending = 0;
        
        // Emit spending limit reset event
        emit!(SpendingLimitResetEvent {
            treasury: treasury_key,
            previous_epoch_spending,
            timestamp: current_time,
            token_mint: Some(token_mint_key),
        });
        
        // Also emit the treasury event for better tracking
        emit!(TreasuryEvent {
            action: AuditAction::SpendingLimitReset as u8,
            treasury: treasury_key,
            initiator: ctx.accounts.authority.key(),
            target: None,
            amount: previous_epoch_spending,
            timestamp: current_time,
            token_mint: Some(token_mint_key),
        });
        
        current_time
    } else {
        ctx.accounts.treasury.last_epoch_start
    };
    
    // Update treasury's epoch data
    ctx.accounts.treasury.last_epoch_start = current_epoch_start;
    
    // Check if this withdrawal would exceed the spending limit
    let new_epoch_spending = token_balance
        .epoch_spending
        .checked_add(payout_amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
        
    require!(
        new_epoch_spending <= ctx.accounts.treasury.spending_limit,
        ErrorCode::SpendingLimitExceeded
    );
    
    // Update token balance state
    token_balance.epoch_spending = new_epoch_spending;
    token_balance.balance = token_balance
        .balance
        .checked_sub(payout_amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    // Transfer tokens from treasury to recipient
    let treasury_seeds = &[
        TREASURY_SEED,
        &[treasury_bump],
    ];
    let treasury_signer = &[&treasury_seeds[..]];
    
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.treasury_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.treasury.to_account_info(),
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
    let audit_log = &mut ctx.accounts.audit_log;
    audit_log.action = AuditAction::TokenPayout as u8;
    audit_log.treasury = treasury_key;
    audit_log.initiator = ctx.accounts.authority.key();
    audit_log.amount = payout_amount;
    audit_log.timestamp = timestamp;
    audit_log.token_mint = Some(token_mint_key);
    audit_log.bump = ctx.bumps.audit_log;
    
    // Emit events
    emit!(TokenPayoutEvent {
        authority: ctx.accounts.authority.key(),
        treasury: treasury_key,
        recipient: ctx.accounts.recipient.recipient,
        token_mint: token_mint_key,
        amount: payout_amount,
        timestamp: current_time,
    });
    
    emit!(TreasuryEvent {
        action: AuditAction::TokenPayout as u8,
        treasury: treasury_key,
        initiator: ctx.accounts.authority.key(),
        target: Some(ctx.accounts.recipient.recipient),
        amount: payout_amount,
        timestamp: current_time,
        token_mint: Some(token_mint_key),
    });
    
    Ok(())
}