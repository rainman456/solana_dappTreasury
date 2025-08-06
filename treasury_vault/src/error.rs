// This file is auto-generated from the CIDL source.
// Editing this file directly is not recommended as it may be overwritten.
//
// Docs: https://docs.codigo.ai/c%C3%B3digo-interface-description-language/specification#errors

use anchor_lang::prelude::*;

#[error_code]
pub enum TreasuryVaultError {
	#[msg("Only the admin can perform this action")]
	InvalidAdmin,
	#[msg("Only treasurers can perform this action")]
	InvalidTreasurer,
	#[msg("The recipient is not whitelisted")]
	RecipientNotWhitelisted,
	#[msg("This payout would exceed the spending limit for this epoch")]
	SpendingLimitExceeded,
	#[msg("This payout is not due yet")]
	PayoutNotDue,
	#[msg("This payout has already been executed")]
	PayoutAlreadyExecuted,
	#[msg("The treasury has insufficient funds for this payout")]
	InsufficientFunds,
	#[msg("The token account is invalid")]
	InvalidTokenAccount,
	#[msg("The user does not hold the required token")]
	InvalidTokenGate,
	#[msg("Epoch duration must be greater than zero")]
	InvalidEpochDuration,
	#[msg("The recipient does not match the payout recipient")]
	InvalidRecipient,
}