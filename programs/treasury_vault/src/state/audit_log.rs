use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AuditLog {
    pub action: u8,                   // 1 byte
    pub initiator: Pubkey,            // 32 bytes
    pub amount: u64,                  // 8 bytes
    pub timestamp: i64,               // 8 bytes
    pub bump: u8,                     // 1 byte
}

impl AuditLog {
    pub const INIT_SPACE: usize = 1 + 32 + 8 + 8 + 1;
}