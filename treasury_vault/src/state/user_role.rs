
use anchor_lang::prelude::*;

#[account]
pub struct UserRole {
	pub treasury: Pubkey,
	pub user: Pubkey,
	pub is_treasurer: bool,
	pub bump: u8,
}
