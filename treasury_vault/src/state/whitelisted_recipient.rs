
use anchor_lang::prelude::*;

#[account]
pub struct WhitelistedRecipient {
	pub treasury: Pubkey,
	pub recipient: Pubkey,
	pub bump: u8,
}
