use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub admin: Pubkey,                // 32 bytes
    pub epoch_duration: u64,          // 8 bytes
    pub spending_limit: u64,          // 8 bytes
    pub total_funds: u64,             // 8 bytes
    pub last_epoch_start: i64,        // 8 bytes
    pub epoch_spending: u64,          // 8 bytes
    pub next_payout_index: u64,       // 8 bytes - For generating unique payout IDs
    pub is_paused: bool,              // 1 byte - Flag to pause/unpause payouts
    pub gate_token_mint: Option<Pubkey>, // 33 bytes (1 for Option + 32 for Pubkey)
    pub bump: u8,                     // 1 byte
}

impl Treasury {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 33 + 1;
    
    pub fn get_next_payout_index(&mut self) -> u64 {
        let index = self.next_payout_index;
        self.next_payout_index = self.next_payout_index.checked_add(1).unwrap();
        index
    }
}