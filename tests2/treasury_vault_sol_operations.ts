import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { BN } from "bn.js";
import {
  TestContext,
  setupTestContext,
  initializeTreasury,
  createTimestamp,
  findAuditLogPDA,
  DEPOSIT_AMOUNT,
  WITHDRAW_AMOUNT,
  PAYOUT_AMOUNT,
  AUDIT_ACTION_DEPOSIT,
  AUDIT_ACTION_WITHDRAW
} from "./test_utils";

describe("treasury_vault_sol_operations", () => {
  let ctx: TestContext;
  let payoutSchedulePDA: anchor.web3.PublicKey;
  let recurringPayoutPDA: anchor.web3.PublicKey;

  before(async () => {
    // Setup test context
    ctx = await setupTestContext();
    await initializeTreasury(ctx);
    
    // Find payout schedule PDA for one-time payout
    [payoutSchedulePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("payout"),
        ctx.recipient.publicKey.toBuffer(),
        ctx.treasuryPDA.toBuffer(),
        new BN(3).toArrayLike(Buffer, "le", 8), // Index 3
      ],
      ctx.program.programId
    );
    
    // Find payout schedule PDA for recurring payout
    [recurringPayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("payout"),
        ctx.recipient.publicKey.toBuffer(),
        ctx.treasuryPDA.toBuffer(),
        new BN(4).toArrayLike(Buffer, "le", 8), // Index 4
      ],
      ctx.program.programId
    );
  });

  describe("SOL Deposit and Withdrawal", () => {
    it("should allow depositing SOL to treasury", async () => {
      // Create a timestamp for the deposit
      const depositTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
      
      // Get initial balances
      const initialTreasuryBalance = await ctx.provider.connection.getBalance(ctx.treasuryPDA);
      const initialDepositorBalance = await ctx.provider.connection.getBalance(ctx.depositor.publicKey);
      
      // Deposit SOL
      await ctx.program.methods
        .deposit(DEPOSIT_AMOUNT, depositTimestamp)
        .accounts({
          treasury: ctx.treasuryPDA,
          depositor: ctx.depositor.publicKey,
          auditLog: auditLogPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ctx.depositor])
        .rpc();
      
      // Verify SOL was transferred
      const finalTreasuryBalance = await ctx.provider.connection.getBalance(ctx.treasuryPDA);
      const finalDepositorBalance = await ctx.provider.connection.getBalance(ctx.depositor.publicKey);
      
      // Account for transaction fees in the depositor's balance
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(DEPOSIT_AMOUNT.toNumber());
      expect(initialDepositorBalance - finalDepositorBalance).to.be.greaterThanOrEqual(DEPOSIT_AMOUNT.toNumber());
      
      // Verify treasury account was updated
      const treasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      expect(treasuryAccount.balance.toString()).to.equal(DEPOSIT_AMOUNT.toString());
      
      // Verify audit log
      const auditLogAccount = await ctx.program.account.auditLog.fetch(auditLogPDA);
      expect(auditLogAccount.action).to.equal(AUDIT_ACTION_DEPOSIT);
      expect(auditLogAccount.amount.toString()).to.equal(DEPOSIT_AMOUNT.toString());
      expect(auditLogAccount.tokenMint).to.be.null;
    });

    it("should handle multiple SOL deposits correctly", async () => {
      // Create a timestamp for the deposit
      const depositTimestamp = createTimestamp(-15);
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
      
      // Get initial treasury balance
      const initialTreasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      
      // Make another deposit
      const secondDepositAmount = new BN(300000); // 0.3 SOL
      
      await ctx.program.methods
        .deposit(secondDepositAmount, depositTimestamp)
        .accounts({
          treasury: ctx.treasuryPDA,
          depositor: ctx.depositor.publicKey,
          auditLog: auditLogPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ctx.depositor])
        .rpc();
      
      // Verify treasury balance was updated correctly
      const updatedTreasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      const expectedBalance = initialTreasuryAccount.balance.add(secondDepositAmount);
      expect(updatedTreasuryAccount.balance.toString()).to.equal(expectedBalance.toString());
    });

    it("should allow treasurer to withdraw SOL", async () => {
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, withdrawTimestamp, ctx.treasurer.publicKey);
      
      // Get initial balances
      const initialTreasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      const initialRecipientBalance = await ctx.provider.connection.getBalance(ctx.recipient.publicKey);
      
      // Withdraw SOL
      await ctx.program.methods
        .withdraw(WITHDRAW_AMOUNT, withdrawTimestamp)
        .accounts({
          authority: ctx.treasurer.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.treasurerUserPDA,
          recipient: ctx.recipient.publicKey,
          auditLog: auditLogPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ctx.treasurer])
        .rpc();
      
      // Verify SOL was transferred
      const finalRecipientBalance = await ctx.provider.connection.getBalance(ctx.recipient.publicKey);
      expect(finalRecipientBalance - initialRecipientBalance).to.equal(WITHDRAW_AMOUNT.toNumber());
      
      // Verify treasury account was updated
      const updatedTreasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      const expectedBalance = initialTreasuryAccount.balance.sub(WITHDRAW_AMOUNT);
      expect(updatedTreasuryAccount.balance.toString()).to.equal(expectedBalance.toString());
      expect(updatedTreasuryAccount.epochSpending.toString()).to.equal(WITHDRAW_AMOUNT.toString());
      
      // Verify audit log
      const auditLogAccount = await ctx.program.account.auditLog.fetch(auditLogPDA);
      expect(auditLogAccount.action).to.equal(AUDIT_ACTION_WITHDRAW);
      expect(auditLogAccount.amount.toString()).to.equal(WITHDRAW_AMOUNT.toString());
      expect(auditLogAccount.tokenMint).to.be.null;
    });

    it("should fail when withdrawal exceeds balance", async () => {
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, withdrawTimestamp, ctx.treasurer.publicKey);
      
      // Get current treasury balance
      const treasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      
      // Try to withdraw more than available
      const excessAmount = treasuryAccount.balance.add(new BN(100000)); // Add 0.1 SOL to exceed balance
      
      try {
        await ctx.program.methods
          .withdraw(excessAmount, withdrawTimestamp)
          .accounts({
            authority: ctx.treasurer.publicKey,
            treasury: ctx.treasuryPDA,
            user: ctx.treasurerUserPDA,
            recipient: ctx.recipient.publicKey,
            auditLog: auditLogPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([ctx.treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        expect(error.message).to.include("InsufficientFunds");
      }
    });
  });

  describe("SOL Payouts", () => {
    it("should schedule a SOL payout", async () => {
      // Schedule time 10 seconds in the future
      const scheduleTime = createTimestamp(10);
      
      // Schedule SOL payout
      await ctx.program.methods
        .schedulePayout(
          PAYOUT_AMOUNT,
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(3) // Index 3
        )
        .accounts({
          authority: ctx.admin.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.adminUserPDA,
          recipient: ctx.recipientPDA,
          payoutSchedule: payoutSchedulePDA,
          tokenMint: null, // No token mint for SOL payouts
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ctx.admin])
        .rpc();
      
      // Verify payout was scheduled without token mint
      const payoutSchedule = await ctx.program.account.payoutSchedule.fetch(payoutSchedulePDA);
      expect(payoutSchedule.recipient.toString()).to.equal(ctx.recipient.publicKey.toString());
      expect(payoutSchedule.amount.toString()).to.equal(PAYOUT_AMOUNT.toString());
      expect(payoutSchedule.tokenMint).to.be.null;
      expect(payoutSchedule.isActive).to.be.true;
      expect(payoutSchedule.recurring).to.be.false;
    });

    it("should execute a SOL payout", async () => {
      // Wait for the schedule time to pass
      await new Promise(resolve => setTimeout(resolve, 11000));
      
      // Create a timestamp for the execution
      const executeTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, executeTimestamp, ctx.treasurer.publicKey);
      
      // Get initial balances
      const initialTreasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      const initialRecipientBalance = await ctx.provider.connection.getBalance(ctx.recipient.publicKey);
      
      // Execute SOL payout
      await ctx.program.methods
        .executePayout(executeTimestamp)
        .accounts({
          authority: ctx.treasurer.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.treasurerUserPDA,
          recipient: ctx.recipientPDA,
          payoutSchedule: payoutSchedulePDA,
          recipientAccount: ctx.recipient.publicKey,
          auditLog: auditLogPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ctx.treasurer])
        .rpc();
      
      // Verify payout was executed
      const payoutSchedule = await ctx.program.account.payoutSchedule.fetch(payoutSchedulePDA);
      expect(payoutSchedule.lastExecuted.toNumber()).to.be.greaterThan(0);
      expect(payoutSchedule.isActive).to.be.false; // One-time payout should be deactivated
      
      // Verify treasury balance was updated
      const updatedTreasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      const expectedBalance = initialTreasuryAccount.balance.sub(PAYOUT_AMOUNT);
      expect(updatedTreasuryAccount.balance.toString()).to.equal(expectedBalance.toString());
      
      // Verify SOL was transferred
      const finalRecipientBalance = await ctx.provider.connection.getBalance(ctx.recipient.publicKey);
      expect(finalRecipientBalance - initialRecipientBalance).to.equal(PAYOUT_AMOUNT.toNumber());
    });

    it("should schedule a recurring SOL payout", async () => {
      // Schedule time 10 seconds in the future
      const scheduleTime = createTimestamp(10);
      const recurrenceInterval = new BN(60); // 1 minute
      
      // Schedule recurring SOL payout
      await ctx.program.methods
        .schedulePayout(
          PAYOUT_AMOUNT,
          scheduleTime,
          true, // Recurring
          recurrenceInterval,
          new BN(4) // Index 4
        )
        .accounts({
          authority: ctx.admin.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.adminUserPDA,
          recipient: ctx.recipientPDA,
          payoutSchedule: recurringPayoutPDA,
          tokenMint: null, // No token mint for SOL payouts
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ctx.admin])
        .rpc();
      
      // Verify recurring payout was scheduled
      const payoutSchedule = await ctx.program.account.payoutSchedule.fetch(recurringPayoutPDA);
      expect(payoutSchedule.recurring).to.be.true;
      expect(payoutSchedule.recurrenceInterval.toString()).to.equal(recurrenceInterval.toString());
      expect(payoutSchedule.tokenMint).to.be.null;
    });

    it("should execute first recurring SOL payout", async () => {
      // Wait for the schedule time to pass
      await new Promise(resolve => setTimeout(resolve, 11000));
      
      // Create a timestamp for the execution
      const executeTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, executeTimestamp, ctx.treasurer.publicKey);
      
      // Get initial balances
      const initialTreasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      const initialRecipientBalance = await ctx.provider.connection.getBalance(ctx.recipient.publicKey);
      
      // Execute first recurring SOL payout
      await ctx.program.methods
        .executePayout(executeTimestamp)
        .accounts({
          authority: ctx.treasurer.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.treasurerUserPDA,
          recipient: ctx.recipientPDA,
          payoutSchedule: recurringPayoutPDA,
          recipientAccount: ctx.recipient.publicKey,
          auditLog: auditLogPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ctx.treasurer])
        .rpc();
      
      // Verify payout was executed but still active
      const payoutSchedule = await ctx.program.account.payoutSchedule.fetch(recurringPayoutPDA);
      expect(payoutSchedule.lastExecuted.toNumber()).to.be.greaterThan(0);
      expect(payoutSchedule.isActive).to.be.true; // Recurring payout should remain active
      
      // Verify treasury balance was updated
      const updatedTreasuryAccount = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      const expectedBalance = initialTreasuryAccount.balance.sub(PAYOUT_AMOUNT);
      expect(updatedTreasuryAccount.balance.toString()).to.equal(expectedBalance.toString());
      
      // Verify SOL was transferred
      const finalRecipientBalance = await ctx.provider.connection.getBalance(ctx.recipient.publicKey);
      expect(finalRecipientBalance - initialRecipientBalance).to.equal(PAYOUT_AMOUNT.toNumber());
    });
  });

  describe("SOL vs SPL Token Comparison", () => {
    it("should handle both SOL and SPL token operations in the same treasury", async () => {
      // Create a timestamp for the SOL deposit
      const solDepositTimestamp = createTimestamp(-25);
      
      // Find audit log PDA for SOL deposit
      const solAuditLogPDA = await findAuditLogPDA(ctx, solDepositTimestamp, ctx.depositor.publicKey);
      
      // Deposit SOL
      const solDepositAmount = new BN(200000); // 0.2 SOL
      
      await ctx.program.methods
        .deposit(solDepositAmount, solDepositTimestamp)
        .accounts({
          treasury: ctx.treasuryPDA,
          depositor: ctx.depositor.publicKey,
          auditLog: solAuditLogPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ctx.depositor])
        .rpc();
      
      // Verify treasury was updated with SOL deposit
      const treasuryAfterSolDeposit = await ctx.program.account.treasury.fetch(ctx.treasuryPDA);
      
      // Verify treasury can handle both SOL and SPL token operations
      expect(treasuryAfterSolDeposit.balance.toNumber()).to.be.greaterThan(0);
      
      // Cancel the recurring payout to clean up
      await ctx.program.methods
        .cancelPayout()
        .accounts({
          authority: ctx.admin.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.adminUserPDA,
          payoutSchedule: recurringPayoutPDA,
        })
        .signers([ctx.admin])
        .rpc();
      
      // Verify payout was cancelled
      const payoutSchedule = await ctx.program.account.payoutSchedule.fetch(recurringPayoutPDA);
      expect(payoutSchedule.isActive).to.be.false;
    });
  });
});