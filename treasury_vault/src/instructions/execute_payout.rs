use crate::*;
use anchor_lang::prelude::*;
use crate::error::TreasuryVaultError;

use anchor_spl::token::Token;

#[derive(Accounts)]
#[instruction(
    mint: Option<Pubkey>,
)]
pub struct ExecutePayout<'info> {
    #[account(
        mut,
        seeds = [
            b"treasury",
            &mint.unwrap_or_else(|| Pubkey::default()).to_bytes(),
        ],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        mut,
        seeds = [
            b"payout",
            treasury.key().as_ref(),
            recipient.key().as_ref(),
            payout.id.to_le_bytes().as_ref(),
        ],
        bump,
        constraint = !payout.executed @ TreasuryVaultError::PayoutAlreadyExecuted,
        constraint = payout.recipient == recipient.key() @ TreasuryVaultError::InvalidRecipient,
    )]
    pub payout: Account<'info, Payout>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
    )]
    /// CHECK: We check that this matches the payout recipient
    pub recipient: UncheckedAccount<'info>,

    #[account(
        seeds = [
            b"whitelist",
            treasury.key().as_ref(),
            recipient.key().as_ref(),
        ],
        bump,
        constraint = whitelist.recipient == recipient.key() @ TreasuryVaultError::RecipientNotWhitelisted,
    )]
    pub whitelist: Account<'info, WhitelistedRecipient>,

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

    pub csl_spl_token_v0_0_0: Program<'info, Token>,
    
    // Add system program for SOL transfers
    pub system_program: Program<'info, System>,
    
    // Optional user role account to check if authority is treasurer
    #[account(
        seeds = [
            b"role",
            treasury.key().as_ref(),
            authority.key().as_ref(),
        ],
        bump,
        seeds::program = crate::ID,
    )]
    pub user_role: Option<Account<'info, UserRole>>,
}

impl<'info> ExecutePayout<'info> {
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
        // Create a PDA signer for the treasury
        let treasury_seeds = &[
            b"treasury",
            self.treasury.mint.as_ref(),
            &[self.treasury.bump],
        ];
        
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &self.source.key(),
            &self.destination.key(),
            amount,
        );
        
        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                self.source.to_account_info(),
                self.destination.to_account_info(),
                self.system_program.to_account_info(),
            ],
            &[treasury_seeds],
        )?;
        
        Ok(())
    }
    
    // Check if epoch has passed and reset spending if needed
    pub fn check_and_update_epoch(&mut self) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        
        // Check if we've moved to a new epoch
        if current_time > self.treasury.epoch_start_time + self.treasury.epoch_duration {
            // Calculate how many epochs have passed
            let epochs_passed = (current_time - self.treasury.epoch_start_time) / self.treasury.epoch_duration;
            
            // Update epoch start time to the beginning of the current epoch
            self.treasury.epoch_start_time += epochs_passed * self.treasury.epoch_duration;
            
            // Reset spending for the new epoch
            self.treasury.current_epoch_spending = 0;
            
            msg!("New epoch started. Spending limit reset.");
        }
        
        Ok(())
    }
}

/// Accounts:
/// 0. `[writable]` treasury: [Treasury] 
/// 1. `[writable]` payout: [Payout] 
/// 2. `[signer]` authority: [AccountInfo] Must be admin or treasurer
/// 3. `[writable]` recipient: [AccountInfo] 
/// 4. `[]` whitelist: [WhitelistedRecipient] Verify recipient is whitelisted
/// 5. `[writable]` source: [AccountInfo] The source account.
/// 6. `[writable]` destination: [AccountInfo] The destination account.
/// 7. `[]` csl_spl_token_v0_0_0: [AccountInfo] Auto-generated, CslSplTokenProgram v0.0.0
///
/// Data:
/// - mint: [Option<Pubkey>] 
pub fn handler(
    ctx: Context<ExecutePayout>,
    mint: Option<Pubkey>,
) -> Result<()> {
    // Verify authority is admin or treasurer
    let is_admin = ctx.accounts.treasury.admin == ctx.accounts.authority.key();
    let is_treasurer = if let Some(user_role) = &ctx.accounts.user_role {
        user_role.is_treasurer
    } else {
        false
    };
    
    if !is_admin && !is_treasurer {
        return err!(TreasuryVaultError::InvalidAdmin);
    }
    
    // Check if payout is due
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;
    
    if current_time < ctx.accounts.payout.scheduled_time {
        return err!(TreasuryVaultError::PayoutNotDue);
    }
    
    // Check and update epoch if needed
    let mut accounts = ctx.accounts;
    accounts.check_and_update_epoch()?;
    
    // Check if this payout would exceed the spending limit
    let new_epoch_spending = accounts.treasury.current_epoch_spending
        .checked_add(accounts.payout.amount)
        .ok_or(TreasuryVaultError::SpendingLimitExceeded)?;
        
    if new_epoch_spending > accounts.treasury.spending_limit {
        return err!(TreasuryVaultError::SpendingLimitExceeded);
    }
    
    // Execute the payout
    let amount = accounts.payout.amount;
    
    // Check if we're transferring SOL or SPL token
    if mint.is_none() || mint.unwrap() == Pubkey::default() {
        // SOL transfer
        msg!("Executing SOL payout of {} to {}", amount, accounts.recipient.key());
        accounts.transfer_sol(amount)?;
    } else {
        // SPL token transfer
        msg!("Executing token payout of {} to {}", amount, accounts.recipient.key());
        accounts.cpi_csl_spl_token_transfer(amount)?;
    }
    
    // Update payout status
    accounts.payout.executed = true;
    
    // Update treasury spending
    accounts.treasury.current_epoch_spending = new_epoch_spending;
    
    // If this is a recurring payout, schedule the next one
    if accounts.payout.recurring && accounts.payout.recurrence_interval.is_some() {
        let interval = accounts.payout.recurrence_interval.unwrap();
        let new_scheduled_time = accounts.payout.scheduled_time + interval;
        
        // Check if we've reached the end time for recurring payouts
        let should_reschedule = if let Some(end_time) = accounts.payout.recurrence_end_time {
            new_scheduled_time <= end_time
        } else {
            true
        };
        
        if should_reschedule {
            // Update for next execution
            accounts.payout.scheduled_time = new_scheduled_time;
            accounts.payout.executed = false;
            
            msg!("Recurring payout rescheduled for {}", new_scheduled_time);
        } else {
            msg!("Final execution of recurring payout completed");
        }
    } else {
        msg!("One-time payout executed successfully");
    }
    
    Ok(())
}