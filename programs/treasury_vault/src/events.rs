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
}

#[event]
pub struct WithdrawEvent {
    pub admin: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
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
}