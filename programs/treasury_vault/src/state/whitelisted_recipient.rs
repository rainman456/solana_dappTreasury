use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct WhitelistedRecipient {
    pub recipient: Pubkey,            // 32 bytes
    #[max_len(32)]
    pub name: String,                 // 4 + 32 bytes (max)
    pub is_active: bool,              // 1 byte
    pub treasury: Pubkey,             // 32 bytes
    pub bump: u8,                     // 1 byte
}

impl WhitelistedRecipient {
    pub const INIT_SPACE: usize = 32 + 4 + 32 + 1 + 32 + 1;
}