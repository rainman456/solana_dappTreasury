use anchor_lang::prelude::*;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Role {
    Admin = 0,
    Treasurer = 1,
}

#[account]
#[derive(InitSpace)]
pub struct TreasuryUser {
    pub user: Pubkey,                 // 32 bytes
    pub role: u8,                     // 1 byte
    pub is_active: bool,              // 1 byte
    pub treasury: Pubkey,             // 32 bytes
    pub bump: u8,                     // 1 byte
}

impl TreasuryUser {
    pub const INIT_SPACE: usize = 32 + 1 + 1 + 32 + 1;
    
    pub fn is_admin(&self) -> bool {
        self.role == Role::Admin as u8 && self.is_active
    }
    
    pub fn is_treasurer(&self) -> bool {
        self.role == Role::Treasurer as u8 && self.is_active
    }
    
    pub fn has_permission(&self, required_role: Role) -> bool {
        if !self.is_active {
            return false;
        }
        
        match required_role {
            Role::Admin => self.role == Role::Admin as u8,
            Role::Treasurer => self.role == Role::Admin as u8 || self.role == Role::Treasurer as u8,
        }
    }
}