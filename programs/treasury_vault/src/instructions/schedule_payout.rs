use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token};

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::*,
};

#[derive(Accounts)]
#[instruction(amount: u64, schedule_time: i64, recurring: bool, recurrence_interval: u64, index: u64)]
pub struct SchedulePayout<'info> {
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
        init,
        payer = authority,
        space = 8 + PayoutSchedule::INIT_SPACE,
        seeds = [
            PAYOUT_SEED, 
            recipient.recipient.as_ref(), 
            treasury.key().as_ref(),
            &index.to_le_bytes()
        ],
        bump
    )]
    pub payout_schedule: Account<'info, PayoutSchedule>,
    
    /// Optional token mint for SPL token payouts
    /// CHECK: This is validated in the handler
    pub token_mint: Option<AccountInfo<'info>>,
    
    /// Optional token program for SPL token payouts
    pub token_program: Option<Program<'info, Token>>,
    
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<SchedulePayout>,
    amount: u64,
    schedule_time: i64,
    recurring: bool,
    recurrence_interval: u64,
    index: u64,
) -> Result<()> {
    // Validate inputs
    require!(amount > 0, ErrorCode::InvalidWithdrawAmount);
    
    let current_time = Clock::get()?.unix_timestamp;
    require!(schedule_time > current_time, ErrorCode::InvalidScheduleTime);
    
    if recurring {
        require!(recurrence_interval > 0, ErrorCode::InvalidRecurrenceInterval);
    }
    
    let payout_schedule = &mut ctx.accounts.payout_schedule;
    let treasury = &mut ctx.accounts.treasury;
    let recipient = &ctx.accounts.recipient;
    
    // Get token mint if provided
    let token_mint_pubkey = if let Some(token_mint) = &ctx.accounts.token_mint {
        // If token mint is provided, token program must also be provided
        require!(ctx.accounts.token_program.is_some(), ErrorCode::TokenProgramRequired);
        
        // Validate token mint
        // We don't need to deserialize it, just check that it's a valid account
        require!(!token_mint.data_is_empty(), ErrorCode::InvalidTokenMint);
        
        Some(token_mint.key())
    } else {
        None
    };
    
    // Initialize payout schedule
    payout_schedule.recipient = recipient.recipient;
    payout_schedule.amount = amount;
    payout_schedule.schedule_time = schedule_time;
    payout_schedule.recurring = recurring;
    payout_schedule.recurrence_interval = recurrence_interval;
    payout_schedule.last_executed = 0; // Not executed yet
    payout_schedule.is_active = true;
    payout_schedule.created_by = ctx.accounts.authority.key();
    payout_schedule.treasury = treasury.key();
    payout_schedule.index = index;
    payout_schedule.token_mint = token_mint_pubkey;
    payout_schedule.bump = ctx.bumps.payout_schedule;
    
    // Create audit log
    emit!(TreasuryEvent {
        action: AuditAction::SchedulePayout as u8,
        treasury: treasury.key(),
        initiator: ctx.accounts.authority.key(),
        target: Some(recipient.recipient),
        amount,
        timestamp: current_time,
        token_mint: token_mint_pubkey,
    });
    
    Ok(())
}