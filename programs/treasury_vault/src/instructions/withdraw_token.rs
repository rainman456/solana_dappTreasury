use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token};

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
#[instruction(amount: u64, timestamp: i64)]
pub struct WithdrawToken<'info> {
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
        constraint = user.has_permission(Role::Treasurer) @ ErrorCode::UnauthorizedWithdrawal
    )]
    pub user: Account<'info, TreasuryUser>,
    
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
    
    /// CHECK: This is the recipient's wallet that will receive the funds
    pub recipient: UncheckedAccount<'info>,
    
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
    ctx: Context<WithdrawToken>,
    amount: u64,
    timestamp: i64,
) -> Result<()> {
    // Validate inputs
    require!(amount > 0, ErrorCode::InvalidWithdrawAmount);
    
    // Validate timestamp is current or in the past
    let current_time = Clock::get()?.unix_timestamp;
    require!(timestamp <= current_time, ErrorCode::InvalidTimestamp);
    
    // Get treasury and token data
    let treasury_key = ctx.accounts.treasury.key();
    let treasury_bump = ctx.accounts.treasury.bump;
    let token_mint_key = ctx.accounts.token_mint.key();
    let recipient_key = ctx.accounts.recipient.key();
    
    // Validate token balance
    let token_balance = &mut ctx.accounts.token_balance;
    require!(token_balance.token_mint == token_mint_key, ErrorCode::InvalidTokenMint);
    require!(token_balance.balance >= amount, ErrorCode::InsufficientTokenBalance);
    
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
        recipient_token_account_data.owner == recipient_key,
        ErrorCode::InvalidTokenAccountOwner
    );
    
    require!(
        recipient_token_account_data.mint == token_mint_key,
        ErrorCode::InvalidTokenMint
    );
    
    // Check if we need to reset the epoch
    let previous_epoch_spending = token_balance.epoch_spending;
    
    if current_time - ctx.accounts.treasury.last_epoch_start > ctx.accounts.treasury.epoch_duration as i64 {
        ctx.accounts.treasury.last_epoch_start = current_time;
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
    }
    
    // Check if withdrawal would exceed spending limit for the current epoch
    let new_epoch_spending = token_balance.epoch_spending
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
        
    require!(
        new_epoch_spending <= ctx.accounts.treasury.spending_limit,
        ErrorCode::SpendingLimitExceeded
    );
    
    // Update token balance state
    token_balance.epoch_spending = new_epoch_spending;
    token_balance.balance = token_balance.balance
        .checked_sub(amount)
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
        amount,
    )?;
    
    // Create audit log
    let audit_log = &mut ctx.accounts.audit_log;
    audit_log.action = AuditAction::Withdraw as u8;
    audit_log.treasury = treasury_key;
    audit_log.initiator = ctx.accounts.authority.key();
    audit_log.amount = amount;
    audit_log.timestamp = timestamp;
    audit_log.token_mint = Some(token_mint_key);
    audit_log.bump = ctx.bumps.audit_log;
    
    // Emit events
    emit!(WithdrawEvent {
        admin: ctx.accounts.authority.key(),
        recipient: recipient_key,
        amount,
        timestamp,
        token_mint: Some(token_mint_key),
    });
    
    emit!(TreasuryEvent {
        action: AuditAction::Withdraw as u8,
        treasury: treasury_key,
        initiator: ctx.accounts.authority.key(),
        target: Some(recipient_key),
        amount,
        timestamp,
        token_mint: Some(token_mint_key),
    });
    
    Ok(())
}