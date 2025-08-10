use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TokenBalance {
    pub treasury: Pubkey,       // 32 bytes - The treasury this balance belongs to
    pub token_mint: Pubkey,     // 32 bytes - The SPL token mint
    pub balance: u64,           // 8 bytes - Current balance of this token
    pub epoch_spending: u64,    // 8 bytes - Amount spent in current epoch
    pub bump: u8,               // 1 byte
}

impl TokenBalance {
    pub const INIT_SPACE: usize = 32 + 32 + 8 + 8 + 1;
    
    pub fn new(treasury: Pubkey, token_mint: Pubkey, bump: u8) -> Self {
        Self {
            treasury,
            token_mint,
            balance: 0,
            epoch_spending: 0,
            bump,
        }
    }
}