pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("DApfsCuhvrUHsGenTT8CjKwF4N8ybGiPDrU27mYDHpSC");

#[program]
pub mod treasury_vault {
    use super::*;

/// Accounts:
/// 0. `[signer]` admin: [AccountInfo] 
/// 1. `[writable]` treasury: [Treasury] 
/// 2. `[]` system_program: [AccountInfo] Auto-generated, for account initialization
///
/// Data:
/// - mint: [Option<Pubkey>] The token mint (null for SOL)
/// - epoch_duration: [i64] Duration of each epoch in seconds
/// - spending_limit: [u64] Maximum amount that can be spent in an epoch
/// - token_gated_mint: [Option<Pubkey>] Optional token mint for token-gated access
	pub fn initialize_treasury(ctx: Context<InitializeTreasury>, mint: Option<Pubkey>, epoch_duration: i64, spending_limit: u64, token_gated_mint: Option<Pubkey>) -> Result<()> {
		initialize_treasury::handler(ctx, mint, epoch_duration, spending_limit, token_gated_mint)
	}

/// Accounts:
/// 0. `[signer]` depositor: [AccountInfo] 
/// 1. `[]` treasury: [Treasury] 
/// 2. `[writable]` source: [AccountInfo] The source account.
/// 3. `[writable]` destination: [AccountInfo] The destination account.
/// 4. `[signer]` authority: [AccountInfo] The source account's owner/delegate.
/// 5. `[]` csl_spl_token_v0_0_0: [AccountInfo] Auto-generated, CslSplTokenProgram v0.0.0
///
/// Data:
/// - mint: [Option<Pubkey>] 
/// - amount: [u64] The amount to deposit
	pub fn deposit(ctx: Context<Deposit>, mint: Option<Pubkey>, amount: u64) -> Result<()> {
		deposit::handler(ctx, mint, amount)
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
	pub fn schedule_payout(ctx: Context<SchedulePayout>, recipient: Pubkey, mint: Option<Pubkey>, amount: u64, scheduled_time: i64, recurring: bool, recurrence_interval: Option<i64>, recurrence_end_time: Option<i64>, id: u64) -> Result<()> {
		schedule_payout::handler(ctx, recipient, mint, amount, scheduled_time, recurring, recurrence_interval, recurrence_end_time, id)
	}

/// Accounts:
/// 0. `[writable]` treasury: [Treasury] 
/// 1. `[writable]` payout: [Payout] 
/// 2. `[signer]` authority: [AccountInfo] Must be admin or treasurer
/// 3. `[writable]` recipient: [AccountInfo] 
/// 4. `[]` whitelist: [WhitelistedRecipient] Verify recipient is whitelisted
/// 5. `[writable]` source: [AccountInfo] The source account.
/// 6. `[writable]` destination: [AccountInfo] The destination account.
/// 7. `[]` csl_spl_token_v0_0_0: [AccountInfo] Auto-generated, CslSplTokenProgram v0.0.0
///
/// Data:
/// - mint: [Option<Pubkey>] 
	pub fn execute_payout(ctx: Context<ExecutePayout>, mint: Option<Pubkey>) -> Result<()> {
		execute_payout::handler(ctx, mint)
	}

/// Accounts:
/// 0. `[writable]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] Current admin
///
/// Data:
/// - new_admin: [Pubkey] New admin address
/// - mint: [Option<Pubkey>] 
	pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey, mint: Option<Pubkey>) -> Result<()> {
		update_admin::handler(ctx, new_admin, mint)
	}

/// Accounts:
/// 0. `[]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
/// 2. `[writable]` user_role: [UserRole] 
/// 3. `[]` system_program: [AccountInfo] Auto-generated, for account initialization
///
/// Data:
/// - user: [Pubkey] User to be given treasurer role
/// - mint: [Option<Pubkey>] 
	pub fn add_treasurer(ctx: Context<AddTreasurer>, user: Pubkey, mint: Option<Pubkey>) -> Result<()> {
		add_treasurer::handler(ctx, user, mint)
	}

/// Accounts:
/// 0. `[]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
/// 2. `[writable]` user_role: [UserRole] 
///
/// Data:
/// - user: [Pubkey] User to remove treasurer role from
/// - mint: [Option<Pubkey>] 
	pub fn remove_treasurer(ctx: Context<RemoveTreasurer>, user: Pubkey, mint: Option<Pubkey>) -> Result<()> {
		remove_treasurer::handler(ctx, user, mint)
	}

/// Accounts:
/// 0. `[]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
/// 2. `[writable]` whitelist: [WhitelistedRecipient] 
/// 3. `[]` system_program: [AccountInfo] Auto-generated, for account initialization
///
/// Data:
/// - recipient: [Pubkey] Recipient to be whitelisted
/// - mint: [Option<Pubkey>] 
	pub fn add_whitelist(ctx: Context<AddWhitelist>, recipient: Pubkey, mint: Option<Pubkey>) -> Result<()> {
		add_whitelist::handler(ctx, recipient, mint)
	}

/// Accounts:
/// 0. `[]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
/// 2. `[writable]` whitelist: [WhitelistedRecipient] 
///
/// Data:
/// - recipient: [Pubkey] Recipient to remove from whitelist
/// - mint: [Option<Pubkey>] 
	pub fn remove_whitelist(ctx: Context<RemoveWhitelist>, recipient: Pubkey, mint: Option<Pubkey>) -> Result<()> {
		remove_whitelist::handler(ctx, recipient, mint)
	}

/// Accounts:
/// 0. `[writable]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
///
/// Data:
/// - new_spending_limit: [u64] New spending limit per epoch
/// - mint: [Option<Pubkey>] 
	pub fn update_spending_limit(ctx: Context<UpdateSpendingLimit>, new_spending_limit: u64, mint: Option<Pubkey>) -> Result<()> {
		update_spending_limit::handler(ctx, new_spending_limit, mint)
	}

/// Accounts:
/// 0. `[writable]` treasury: [Treasury] 
/// 1. `[signer]` admin: [AccountInfo] 
///
/// Data:
/// - new_epoch_duration: [i64] New epoch duration in seconds
/// - mint: [Option<Pubkey>] 
	pub fn update_epoch_duration(ctx: Context<UpdateEpochDuration>, new_epoch_duration: i64, mint: Option<Pubkey>) -> Result<()> {
		update_epoch_duration::handler(ctx, new_epoch_duration, mint)
	}
}