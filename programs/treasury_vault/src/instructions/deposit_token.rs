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
pub struct DepositToken<'info> {
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump,
        constraint = !treasury.is_paused @ ErrorCode::TreasuryPaused
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(
        init_if_needed,
        payer = depositor,
        space = 8 + TokenBalance::INIT_SPACE,
        seeds = [TOKEN_BALANCE_SEED, treasury.key().as_ref(), token_mint.key().as_ref()],
        bump,
    )]
    pub token_balance: Account<'info, TokenBalance>,
    
    /// CHECK: This is validated in the handler
    #[account(mut)]
    pub treasury_token_account: AccountInfo<'info>,
    
    /// CHECK: This is validated in the handler
    #[account(mut)]
    pub depositor_token_account: AccountInfo<'info>,
    
    /// CHECK: This is validated in the handler
    pub token_mint: AccountInfo<'info>,
    
    #[account(
        init,
        payer = depositor,
        space = 8 + AuditLog::INIT_SPACE,
        seeds = [
            AUDIT_SEED, 
            treasury.key().as_ref(), 
            &timestamp.to_le_bytes(), 
            depositor.key().as_ref()
        ],
        bump
    )]
    pub audit_log: Account<'info, AuditLog>,
    
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<DepositToken>,
    amount: u64,
    timestamp: i64,
) -> Result<()> {
    // Validate inputs
    require!(amount > 0, ErrorCode::InvalidDepositAmount);
    
    let current_time = Clock::get()?.unix_timestamp;
    require!(timestamp <= current_time, ErrorCode::InvalidTimestamp);
    
    // Get accounts
    let treasury = &ctx.accounts.treasury;
    let token_balance = &mut ctx.accounts.token_balance;
    let depositor = &ctx.accounts.depositor;
    let token_mint = &ctx.accounts.token_mint;
    
    // Get treasury key before mutable borrow
    let treasury_key = treasury.key();
    let token_mint_key = token_mint.key();
    
    // Validate token accounts
    // We need to check that the depositor token account belongs to the depositor and has the correct mint
    let depositor_token_account = &ctx.accounts.depositor_token_account;
    let depositor_token_account_data = token::TokenAccount::try_deserialize(&mut &depositor_token_account.data.borrow()[..])?;
    
    require!(
        depositor_token_account_data.owner == depositor.key(),
        ErrorCode::InvalidTokenAccountOwner
    );
    
    require!(
        depositor_token_account_data.mint == token_mint_key,
        ErrorCode::InvalidTokenMint
    );
    
    require!(
        depositor_token_account_data.amount >= amount,
        ErrorCode::InsufficientTokenBalance
    );
    
    // Validate treasury token account
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
    
    // If token balance account is new, initialize it
    if token_balance.treasury == Pubkey::default() {
        token_balance.treasury = treasury_key;
        token_balance.token_mint = token_mint_key;
        token_balance.balance = 0;
        token_balance.epoch_spending = 0;
        token_balance.bump = ctx.bumps.token_balance;
        
        // Emit token balance created event
        emit!(TokenBalanceCreatedEvent {
            treasury: treasury_key,
            token_mint: token_mint_key,
            timestamp: current_time,
        });
    }
    
    // Transfer tokens from depositor to treasury token account
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.depositor_token_account.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        amount,
    )?;
    
    // Update token balance
    token_balance.balance = token_balance.balance.checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    // Create audit log
    let audit_log = &mut ctx.accounts.audit_log;
    audit_log.action = AuditAction::TokenDeposit as u8;
    audit_log.treasury = treasury_key;
    audit_log.initiator = depositor.key();
    audit_log.amount = amount;
    audit_log.timestamp = timestamp;
    audit_log.token_mint = Some(token_mint_key);
    audit_log.bump = ctx.bumps.audit_log;
    
    // Emit events
    emit!(TokenDepositEvent {
        depositor: depositor.key(),
        treasury: treasury_key,
        token_mint: token_mint_key,
        amount,
        timestamp,
    });
    
    emit!(TreasuryEvent {
        action: AuditAction::TokenDeposit as u8,
        treasury: treasury_key,
        initiator: depositor.key(),
        target: Some(token_mint_key),
        amount,
        timestamp,
        token_mint: Some(token_mint_key),
    });
    
    Ok(())
}