use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Epoch duration must be greater than zero")]
    InvalidEpochDuration,
    #[msg("Spending limit must be greater than zero")]
    InvalidSpendingLimit,
    #[msg("Deposit amount must be greater than zero")]
    InvalidDepositAmount,
    #[msg("Withdraw amount must be greater than zero")]
    InvalidWithdrawAmount,
    #[msg("Timestamp must be current or in the past")]
    InvalidTimestamp,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    #[msg("Insufficient funds in treasury")]
    InsufficientFunds,
    #[msg("Only the admin can withdraw funds")]
    UnauthorizedWithdrawal,
    #[msg("Only the admin can update treasury configuration")]
    UnauthorizedConfigUpdate,
    #[msg("Withdrawal would exceed spending limit for current epoch")]
    SpendingLimitExceeded,
    #[msg("Invalid role specified")]
    InvalidRole,
    #[msg("User is not authorized to perform this action")]
    UnauthorizedUser,
    #[msg("Recipient is not whitelisted")]
    RecipientNotWhitelisted,
    #[msg("Schedule time must be in the future")]
    InvalidScheduleTime,
    #[msg("Recurrence interval must be greater than zero for recurring payouts")]
    InvalidRecurrenceInterval,
    #[msg("Payout is not due yet")]
    PayoutNotDue,
    #[msg("Payout has already been executed")]
    PayoutAlreadyExecuted,
    #[msg("Payout schedule is not active")]
    PayoutNotActive,
    #[msg("Recipient is not active")]
    RecipientNotActive,
    #[msg("Treasury is paused")]
    TreasuryPaused,
    #[msg("Treasury is already paused")]
    TreasuryAlreadyPaused,
    #[msg("Treasury is already unpaused")]
    TreasuryAlreadyUnpaused,
    #[msg("Only admin can pause or unpause the treasury")]
    UnauthorizedPauseAction,
    #[msg("Epoch duration must be at least the minimum duration")]
    EpochDurationTooShort,
    #[msg("Recipient does not hold the required token")]
    TokenGateCheckFailed,
    #[msg("Token program is required for token-gated payouts")]
    TokenProgramRequired,
    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Token account has insufficient balance")]
    InsufficientTokenBalance,
    #[msg("Token balance account not found")]
    TokenBalanceNotFound,
    #[msg("Treasury token account not found")]
    TreasuryTokenAccountNotFound,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
}