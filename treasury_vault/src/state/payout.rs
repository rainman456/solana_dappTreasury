
use anchor_lang::prelude::*;

#[account]
pub struct Payout {
	pub treasury: Pubkey,
	pub recipient: Pubkey,
	pub amount: u64,
	pub scheduled_time: i64,
	pub executed: bool,
	pub recurring: bool,
	pub recurrence_interval: Option<i64>,
	pub recurrence_end_time: Option<i64>,
	pub id: u64,
	pub bump: u8,
}
