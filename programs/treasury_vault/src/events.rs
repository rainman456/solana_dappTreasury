use anchor_lang::prelude::*;

#[event]
pub struct TreasuryInitializedEvent {
    pub admin: Pubkey,
    pub epoch_duration: u64,
    pub spending_limit: u64,
}

#[event]
pub struct DepositEvent {
    pub depositor: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub token_mint: Option<Pubkey>,
}

#[event]
pub struct WithdrawEvent {
    pub admin: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub token_mint: Option<Pubkey>,
}

#[event]
pub struct TreasuryConfigUpdatedEvent {
    pub admin: Pubkey,
    pub epoch_duration: u64,
    pub spending_limit: u64,
}

#[event]
pub struct TreasuryEvent {
    pub action: u8,
    pub treasury: Pubkey,
    pub initiator: Pubkey,
    pub target: Option<Pubkey>,
    pub amount: u64,
    pub timestamp: i64,
    pub token_mint: Option<Pubkey>,
}

#[event]
pub struct TreasuryPausedEvent {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TreasuryUnpausedEvent {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SpendingLimitResetEvent {
    pub treasury: Pubkey,
    pub previous_epoch_spending: u64,
    pub timestamp: i64,
    pub token_mint: Option<Pubkey>,
}

#[event]
pub struct TokenGateSetEvent {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub token_mint: Option<Pubkey>,
    pub timestamp: i64,
}

#[event]
pub struct EpochDurationUpdatedEvent {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub old_duration: u64,
    pub new_duration: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenBalanceCreatedEvent {
    pub treasury: Pubkey,
    pub token_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TokenDepositEvent {
    pub depositor: Pubkey,
    pub treasury: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenPayoutEvent {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub recipient: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}