use crate::*;
use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction(
    mint: Option<Pubkey>,
    amount: u64,
)]
pub struct Deposit<'info> {
    pub depositor: Signer<'info>,

    #[account(
        seeds = [
            b"treasury",
            mint.as_ref(),
        ],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        mut,
    )]
    /// CHECK: implement manual checks if needed
    pub source: UncheckedAccount<'info>,

    #[account(
        mut,
    )]
    /// CHECK: implement manual checks if needed
    pub destination: UncheckedAccount<'info>,

    #[account(
        owner=Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap(),
    )]
    pub authority: Signer<'info>,

    pub csl_spl_token_v0_0_0: Program<'info, Token>,
    
    // Add system program for SOL transfers
    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn cpi_csl_spl_token_transfer(&self, amount: u64) -> Result<()> {
        anchor_spl::token::transfer(
            CpiContext::new(self.csl_spl_token_v0_0_0.to_account_info(), 
                anchor_spl::token::Transfer {
                    from: self.source.to_account_info(),
                    to: self.destination.to_account_info(),
                    authority: self.authority.to_account_info()
                }
            ),
            amount, 
        )
    }
    
    // Add function for SOL transfers
    pub fn transfer_sol(&self, amount: u64) -> Result<()> {
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &self.depositor.key(),
            &self.destination.key(),
            amount,
        );
        
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                self.depositor.to_account_info(),
                self.destination.to_account_info(),
                self.system_program.to_account_info(),
            ],
        )?;
        
        Ok(())
    }
}

/// Accounts:
/// 0. `[signer]` depositor: [AccountInfo] 
/// 1. `[]` treasury: [Treasury] 
/// 2. `[writable]` source: [AccountInfo] The source account.
/// 3. `[writable]` destination: [AccountInfo] The destination account.
/// 4. `[signer]` authority: [AccountInfo] The source account's owner/delegate.
/// 5. `[]` csl_spl_token_v0_0_0: [AccountInfo] Auto-generated, CslSplTokenProgram v0.0.0
///
/// Data:
/// - mint: [Option<Pubkey>] 
/// - amount: [u64] The amount to deposit
pub fn handler(
    ctx: Context<Deposit>,
    mint: Option<Pubkey>,
    amount: u64,
) -> Result<()> {
    // Validate amount
    if amount == 0 {
        return err!(TreasuryVaultError::InsufficientFunds);
    }
    
    // Check if we're depositing SOL or SPL token
    if mint.is_none() || mint.unwrap() == Pubkey::default() {
        // SOL deposit
        msg!("Depositing {} SOL to treasury", amount);
        ctx.accounts.transfer_sol(amount)?;
    } else {
        // SPL token deposit
        msg!("Depositing {} tokens to treasury", amount);
        ctx.accounts.cpi_csl_spl_token_transfer(amount)?;
    }
    
    msg!("Deposit successful");
    
    Ok(())
}