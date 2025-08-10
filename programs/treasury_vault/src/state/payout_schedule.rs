use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PayoutSchedule {
    pub recipient: Pubkey,            // 32 bytes
    pub amount: u64,                  // 8 bytes
    pub schedule_time: i64,           // 8 bytes
    pub recurring: bool,              // 1 byte
    pub recurrence_interval: u64,     // 8 bytes
    pub last_executed: i64,           // 8 bytes
    pub is_active: bool,              // 1 byte
    pub created_by: Pubkey,           // 32 bytes
    pub treasury: Pubkey,             // 32 bytes
    pub index: u64,                   // 8 bytes
    pub token_mint: Option<Pubkey>,   // 33 bytes (1 for Option + 32 for Pubkey)
    pub bump: u8,                     // 1 byte
}

impl PayoutSchedule {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 1 + 8 + 8 + 1 + 32 + 32 + 8 + 33 + 1;
    
    pub fn is_due(&self, current_time: i64) -> bool {
        if !self.is_active {
            return false;
        }
        
        if self.recurring {
            // For recurring payouts, check if enough time has passed since last execution
            if self.last_executed == 0 {
                // First execution
                return current_time >= self.schedule_time;
            } else {
                // Check if recurrence_interval has passed since last execution
                return current_time >= (self.last_executed + self.recurrence_interval as i64);
            }
        } else {
            // For one-time payouts, check if it's time and hasn't been executed yet
            return current_time >= self.schedule_time && self.last_executed == 0;
        }
    }
}