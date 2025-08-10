use anchor_lang::prelude::*;

mod constants;
mod error;
mod events;
mod instructions;
mod state;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod treasury_vault {
    use super::*;

    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        epoch_duration: u64,
        spending_limit: u64,
    ) -> Result<()> {
        instructions::initialize_treasury::handler(ctx, epoch_duration, spending_limit)
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
        timestamp: i64,
    ) -> Result<()> {
        instructions::deposit::handler(ctx, amount, timestamp)
    }
    
    pub fn deposit_token(
        ctx: Context<DepositToken>,
        amount: u64,
        timestamp: i64,
    ) -> Result<()> {
        instructions::deposit_token::handler(ctx, amount, timestamp)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount: u64,
        timestamp: i64,
    ) -> Result<()> {
        instructions::withdraw::handler(ctx, amount, timestamp)
    }
    
    pub fn withdraw_token(
        ctx: Context<WithdrawToken>,
        amount: u64,
        timestamp: i64,
    ) -> Result<()> {
        instructions::withdraw_token::handler(ctx, amount, timestamp)
    }

    pub fn update_treasury_config(
        ctx: Context<UpdateTreasuryConfig>,
        epoch_duration: Option<u64>,
        spending_limit: Option<u64>,
    ) -> Result<()> {
        instructions::update_treasury_config::handler(ctx, epoch_duration, spending_limit)
    }
    
    pub fn add_treasury_user(
        ctx: Context<AddTreasuryUser>,
        role: u8,
    ) -> Result<()> {
        instructions::add_treasury_user::handler(ctx, role)
    }
    
    pub fn add_whitelisted_recipient(
        ctx: Context<AddWhitelistedRecipient>,
        name: String,
    ) -> Result<()> {
        instructions::add_whitelisted_recipient::handler(ctx, name)
    }
    
    pub fn schedule_payout(
        ctx: Context<SchedulePayout>,
        amount: u64,
        schedule_time: i64,
        recurring: bool,
        recurrence_interval: u64,
        index: u64,
    ) -> Result<()> {
        instructions::schedule_payout::handler(ctx, amount, schedule_time, recurring, recurrence_interval, index)
    }
    
    pub fn execute_payout(
        ctx: Context<ExecutePayout>,
        timestamp: i64,
    ) -> Result<()> {
        instructions::execute_payout::handler(ctx, timestamp)
    }
    
    pub fn execute_token_payout(
        ctx: Context<ExecuteTokenPayout>,
        timestamp: i64,
    ) -> Result<()> {
        instructions::execute_token_payout::handler(ctx, timestamp)
    }
    
    pub fn cancel_payout(
        ctx: Context<CancelPayout>,
    ) -> Result<()> {
        instructions::cancel_payout::handler(ctx)
    }
    
    pub fn pause_treasury(
        ctx: Context<PauseTreasury>,
    ) -> Result<()> {
        instructions::pause_treasury::handler(ctx)
    }
    
    pub fn unpause_treasury(
        ctx: Context<UnpauseTreasury>,
    ) -> Result<()> {
        instructions::unpause_treasury::handler(ctx)
    }
    
    pub fn set_token_gate(
        ctx: Context<SetTokenGate>,
    ) -> Result<()> {
        instructions::set_token_gate::handler(ctx)
    }
}