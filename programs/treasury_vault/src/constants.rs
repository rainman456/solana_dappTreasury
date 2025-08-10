use anchor_lang::prelude::*;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AuditAction {
    Deposit = 0,
    Withdraw = 1,
    SchedulePayout = 2,
    ExecutePayout = 3,
    CancelPayout = 4,
    AddUser = 5,
    AddRecipient = 6,
    PauseTreasury = 7,
    UnpauseTreasury = 8,
    SpendingLimitReset = 9,
    TokenGateSet = 10,
    EpochDurationUpdated = 11,
    TokenDeposit = 12,
    TokenPayout = 13,
}

pub const TREASURY_SEED: &[u8] = b"treasury";
pub const USER_SEED: &[u8] = b"user";
pub const RECIPIENT_SEED: &[u8] = b"recipient";
pub const PAYOUT_SEED: &[u8] = b"payout";
pub const AUDIT_SEED: &[u8] = b"audit";
pub const TOKEN_BALANCE_SEED: &[u8] = b"token_balance";
pub const TREASURY_TOKEN_ACCOUNT_SEED: &[u8] = b"treasury_token";

// Minimum epoch duration in seconds (1 hour)
pub const MIN_EPOCH_DURATION: u64 = 3600;