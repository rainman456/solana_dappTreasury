
use anchor_lang::prelude::*;

#[account]
pub struct Treasury {
	pub admin: Pubkey,
	pub mint: Pubkey,
	pub epoch_duration: i64,
	pub epoch_start_time: i64,
	pub spending_limit: u64,
	pub current_epoch_spending: u64,
	pub token_gated_mint: Option<Pubkey>,
	pub bump: u8,
}
