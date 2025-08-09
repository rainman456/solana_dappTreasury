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
}

pub const TREASURY_SEED: &[u8] = b"treasury";
pub const USER_SEED: &[u8] = b"user";
pub const RECIPIENT_SEED: &[u8] = b"recipient";
pub const PAYOUT_SEED: &[u8] = b"payout";
pub const AUDIT_SEED: &[u8] = b"audit";