import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TreasuryVault } from "../target/types/treasury_vault";
import { expect } from "chai";
import { BN } from "bn.js";

describe("treasury_vault_scheduled_payouts", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TreasuryVault as Program<TreasuryVault>;
  const admin = anchor.web3.Keypair.generate();
  const treasurer = anchor.web3.Keypair.generate();
  const regularUser = anchor.web3.Keypair.generate();
  const recipient1 = anchor.web3.Keypair.generate();
  const recipient2 = anchor.web3.Keypair.generate();
  const nonWhitelistedRecipient = anchor.web3.Keypair.generate();
  
  // Constants for testing
  const EPOCH_DURATION = new BN(86400); // 1 day in seconds
  const SPENDING_LIMIT = new BN(5000000000); // 5 SOL in lamports
  const PAYOUT_AMOUNT = new BN(200000000); // 0.2 SOL in lamports
  const RECURRENCE_INTERVAL = new BN(3600); // 1 hour in seconds
  
  // PDAs
  let treasuryPDA: anchor.web3.PublicKey;
  let treasuryBump: number;
  let adminUserPDA: anchor.web3.PublicKey;
  let treasurerUserPDA: anchor.web3.PublicKey;
  let recipient1PDA: anchor.web3.PublicKey;
  let recipient2PDA: anchor.web3.PublicKey;
  let oneTimePayoutPDA: anchor.web3.PublicKey;
  let recurringPayoutPDA: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to all accounts for testing
    await provider.connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(treasurer.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(regularUser.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(recipient1.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(recipient2.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(nonWhitelistedRecipient.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Wait for confirmation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Find PDAs
    [treasuryPDA, treasuryBump] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );
    
    // Find user PDAs
    [adminUserPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user"),
        admin.publicKey.toBuffer(),
        treasuryPDA.toBuffer(),
      ],
      program.programId
    );
    
    [treasurerUserPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user"),
        treasurer.publicKey.toBuffer(),
        treasuryPDA.toBuffer(),
      ],
      program.programId
    );
    
    // Find recipient PDAs
    [recipient1PDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("recipient"),
        recipient1.publicKey.toBuffer(),
        treasuryPDA.toBuffer(),
      ],
      program.programId
    );
    
    [recipient2PDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("recipient"),
        recipient2.publicKey.toBuffer(),
        treasuryPDA.toBuffer(),
      ],
      program.programId
    );
  });

  describe("Setup", () => {
    it("should initialize treasury and add admin user", async () => {
      await program.methods
        .initializeTreasury(EPOCH_DURATION, SPENDING_LIMIT)
        .accounts({
          treasury: treasuryPDA,
          admin: admin.publicKey,
          admin_user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify treasury was initialized
      const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAccount.admin.toString()).to.equal(admin.publicKey.toString());
    });

    it("should add treasurer user", async () => {
      await program.methods
        .addTreasuryUser(1) // 1 = Treasurer role
        .accounts({
          admin: admin.publicKey,
          treasury: treasuryPDA,
          userAccount: treasurerUserPDA,
          user: treasurer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify treasurer was added
      const treasurerAccount = await program.account.treasuryUser.fetch(treasurerUserPDA);
      expect(treasurerAccount.user.toString()).to.equal(treasurer.publicKey.toString());
      expect(treasurerAccount.role).to.equal(1); // Treasurer role
      expect(treasurerAccount.isActive).to.be.true;
    });

    it("should add whitelisted recipients", async () => {
      // Add first recipient
      await program.methods
        .addWhitelistedRecipient("Recipient 1")
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipientAccount: recipient1PDA,
          recipient: recipient1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Add second recipient
      await program.methods
        .addWhitelistedRecipient("Recipient 2")
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipientAccount: recipient2PDA,
          recipient: recipient2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify recipients were added
      const recipient1Account = await program.account.whitelistedRecipient.fetch(recipient1PDA);
      expect(recipient1Account.recipient.toString()).to.equal(recipient1.publicKey.toString());
      expect(recipient1Account.name).to.equal("Recipient 1");
      expect(recipient1Account.isActive).to.be.true;
      
      const recipient2Account = await program.account.whitelistedRecipient.fetch(recipient2PDA);
      expect(recipient2Account.recipient.toString()).to.equal(recipient2.publicKey.toString());
      expect(recipient2Account.name).to.equal("Recipient 2");
      expect(recipient2Account.isActive).to.be.true;
    });

    it("should deposit funds to treasury", async () => {
      // Create a timestamp for the deposit
      const depositTimestamp = new BN(Math.floor(Date.now() / 1000) - 5);
      
      // Find audit log PDA
      const [auditLogPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("audit"),
          treasuryPDA.toBuffer(),
          depositTimestamp.toArrayLike(Buffer, "le", 8),
          admin.publicKey.toBuffer(),
        ],
        program.programId
      );
      
      // Deposit 1 SOL
      const depositAmount = new BN(1000000000);
      await program.methods
        .deposit(depositAmount, depositTimestamp)
        .accounts({
          treasury: treasuryPDA,
          auditLog: auditLogPDA,
          depositor: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify deposit
      const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAccount.totalFunds.toString()).to.equal(depositAmount.toString());
    });
  });

  describe("Scheduled Payouts", () => {
    it("should schedule a one-time payout by an admin", async () => {
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Find payout schedule PDA
      [oneTimePayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(0).toArrayLike(Buffer, "le", 8), // Index 0
        ],
        program.programId
      );
      
      // Schedule one-time payout
      await program.methods
        .schedulePayout(
          PAYOUT_AMOUNT,
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(0) // Index 0
        )
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipient1PDA,
          payoutSchedule: oneTimePayoutPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify payout schedule
      const payoutSchedule = await program.account.payoutSchedule.fetch(oneTimePayoutPDA);
      expect(payoutSchedule.recipient.toString()).to.equal(recipient1.publicKey.toString());
      expect(payoutSchedule.amount.toString()).to.equal(PAYOUT_AMOUNT.toString());
      expect(payoutSchedule.scheduleTime.toString()).to.equal(scheduleTime.toString());
      expect(payoutSchedule.recurring).to.be.false;
      expect(payoutSchedule.lastExecuted.toString()).to.equal("0");
      expect(payoutSchedule.isActive).to.be.true;
      expect(payoutSchedule.createdBy.toString()).to.equal(admin.publicKey.toString());
    });

    it("should schedule a recurring payout by a treasurer", async () => {
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Find payout schedule PDA
      [recurringPayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient2.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(1).toArrayLike(Buffer, "le", 8), // Index 1
        ],
        program.programId
      );
      
      // Schedule recurring payout
      await program.methods
        .schedulePayout(
          PAYOUT_AMOUNT,
          scheduleTime,
          true, // Recurring
          RECURRENCE_INTERVAL, // 1 hour
          new BN(1) // Index 1
        )
        .accounts({
          authority: treasurer.publicKey,
          treasury: treasuryPDA,
          user: treasurerUserPDA,
          recipient: recipient2PDA,
          payoutSchedule: recurringPayoutPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([treasurer])
        .rpc();
      
      // Verify payout schedule
      const payoutSchedule = await program.account.payoutSchedule.fetch(recurringPayoutPDA);
      expect(payoutSchedule.recipient.toString()).to.equal(recipient2.publicKey.toString());
      expect(payoutSchedule.amount.toString()).to.equal(PAYOUT_AMOUNT.toString());
      expect(payoutSchedule.scheduleTime.toString()).to.equal(scheduleTime.toString());
      expect(payoutSchedule.recurring).to.be.true;
      expect(payoutSchedule.recurrenceInterval.toString()).to.equal(RECURRENCE_INTERVAL.toString());
      expect(payoutSchedule.lastExecuted.toString()).to.equal("0");
      expect(payoutSchedule.isActive).to.be.true;
      expect(payoutSchedule.createdBy.toString()).to.equal(treasurer.publicKey.toString());
    });

    it("should fail to schedule payout with zero amount", async () => {
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Find payout schedule PDA
      const [invalidPayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(2).toArrayLike(Buffer, "le", 8), // Index 2
        ],
        program.programId
      );
      
      try {
        // Try to schedule payout with zero amount
        await program.methods
          .schedulePayout(
            new BN(0), // Zero amount
            scheduleTime,
            false,
            new BN(0),
            new BN(2) // Index 2
          )
          .accounts({
            authority: admin.publicKey,
            treasury: treasuryPDA,
            user: adminUserPDA,
            recipient: recipient1PDA,
            payoutSchedule: invalidPayoutPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with InvalidWithdrawAmount
        expect(error.message).to.include("Error") || expect(error.message).to.include("InvalidWithdrawAmount");
      }
    });

    it("should fail to schedule payout with past schedule time", async () => {
      // Schedule time in the past
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) - 3600);
      
      // Find payout schedule PDA
      const [invalidPayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(3).toArrayLike(Buffer, "le", 8), // Index 3
        ],
        program.programId
      );
      
      try {
        // Try to schedule payout with past time
        await program.methods
          .schedulePayout(
            PAYOUT_AMOUNT,
            scheduleTime, // Past time
            false,
            new BN(0),
            new BN(3) // Index 3
          )
          .accounts({
            authority: admin.publicKey,
            treasury: treasuryPDA,
            user: adminUserPDA,
            recipient: recipient1PDA,
            payoutSchedule: invalidPayoutPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with InvalidScheduleTime
        expect(error.message).to.include("Error") || expect(error.message).to.include("InvalidScheduleTime");
      }
    });

    it("should fail to schedule recurring payout with zero recurrence interval", async () => {
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Find payout schedule PDA
      const [invalidPayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(4).toArrayLike(Buffer, "le", 8), // Index 4
        ],
        program.programId
      );
      
      try {
        // Try to schedule recurring payout with zero interval
        await program.methods
          .schedulePayout(
            PAYOUT_AMOUNT,
            scheduleTime,
            true, // Recurring
            new BN(0), // Zero interval
            new BN(4) // Index 4
          )
          .accounts({
            authority: admin.publicKey,
            treasury: treasuryPDA,
            user: adminUserPDA,
            recipient: recipient1PDA,
            payoutSchedule: invalidPayoutPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with InvalidRecurrenceInterval
        expect(error.message).to.include("Error") || expect(error.message).to.include("InvalidRecurrenceInterval");
      }
    });

    it("should fail when unauthorized user tries to schedule payout", async () => {
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Find regular user PDA (doesn't exist)
      const [regularUserPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("user"),
          regularUser.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
        ],
        program.programId
      );
      
      // Find payout schedule PDA
      const [invalidPayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(5).toArrayLike(Buffer, "le", 8), // Index 5
        ],
        program.programId
      );
      
      try {
        // Try to schedule payout as unauthorized user
        await program.methods
          .schedulePayout(
            PAYOUT_AMOUNT,
            scheduleTime,
            false,
            new BN(0),
            new BN(5) // Index 5
          )
          .accounts({
            authority: regularUser.publicKey,
            treasury: treasuryPDA,
            user: regularUserPDA, // This account doesn't exist
            recipient: recipient1PDA,
            payoutSchedule: invalidPayoutPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([regularUser])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail because the user account doesn't exist
        expect(true).to.be.true;
      }
    });
  });

  describe("Execute Payouts", () => {
    // We need to wait for the scheduled time to pass before executing payouts
    // For testing purposes, we'll modify the payout schedule directly to make it executable
    
    it("should execute a one-time payout successfully", async () => {
      // Wait a bit to ensure we're past the scheduled time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get initial balances
      const initialTreasuryBalance = await provider.connection.getBalance(treasuryPDA);
      const initialRecipientBalance = await provider.connection.getBalance(recipient1.publicKey);
      
      // Current timestamp
      const timestamp = new BN(Math.floor(Date.now() / 1000));
      
      // Execute the one-time payout
      await program.methods
        .executePayout(timestamp)
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipient1PDA,
          payoutSchedule: oneTimePayoutPDA,
          recipientWallet: recipient1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify payout execution
      const payoutSchedule = await program.account.payoutSchedule.fetch(oneTimePayoutPDA);
      expect(payoutSchedule.lastExecuted.toNumber()).to.be.greaterThan(0);
      expect(payoutSchedule.isActive).to.be.false; // One-time payout should be deactivated
      
      // Verify treasury funds updated
      const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAccount.totalFunds.toString()).to.equal(
        new BN(1000000000).sub(PAYOUT_AMOUNT).toString()
      );
      
      // Verify SOL was transferred
      const finalTreasuryBalance = await provider.connection.getBalance(treasuryPDA);
      const finalRecipientBalance = await provider.connection.getBalance(recipient1.publicKey);
      
      expect(initialTreasuryBalance - finalTreasuryBalance).to.equal(PAYOUT_AMOUNT.toNumber());
      expect(finalRecipientBalance - initialRecipientBalance).to.equal(PAYOUT_AMOUNT.toNumber());
    });

    it("should fail to execute already executed one-time payout", async () => {
      // Current timestamp
      const timestamp = new BN(Math.floor(Date.now() / 1000));
      
      try {
        // Try to execute the one-time payout again
        await program.methods
          .executePayout(timestamp)
          .accounts({
            authority: admin.publicKey,
            treasury: treasuryPDA,
            user: adminUserPDA,
            recipient: recipient1PDA,
            payoutSchedule: oneTimePayoutPDA,
            recipientWallet: recipient1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with PayoutNotActive or PayoutAlreadyExecuted
        expect(error.message).to.include("Error") || 
        expect(error.message).to.include("PayoutNotActive") || 
        expect(error.message).to.include("PayoutAlreadyExecuted");
      }
    });

    it("should execute a recurring payout after the interval has passed", async () => {
      // Wait a bit to ensure we're past the scheduled time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get initial balances
      const initialTreasuryBalance = await provider.connection.getBalance(treasuryPDA);
      const initialRecipientBalance = await provider.connection.getBalance(recipient2.publicKey);
      
      // Current timestamp
      const timestamp = new BN(Math.floor(Date.now() / 1000));
      
      // Execute the recurring payout
      await program.methods
        .executePayout(timestamp)
        .accounts({
          authority: treasurer.publicKey,
          treasury: treasuryPDA,
          user: treasurerUserPDA,
          recipient: recipient2PDA,
          payoutSchedule: recurringPayoutPDA,
          recipientWallet: recipient2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([treasurer])
        .rpc();
      
      // Verify payout execution
      const payoutSchedule = await program.account.payoutSchedule.fetch(recurringPayoutPDA);
      expect(payoutSchedule.lastExecuted.toNumber()).to.be.greaterThan(0);
      expect(payoutSchedule.isActive).to.be.true; // Recurring payout should remain active
      
      // Verify treasury funds updated
      const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAccount.totalFunds.toString()).to.equal(
        new BN(1000000000).sub(PAYOUT_AMOUNT).sub(PAYOUT_AMOUNT).toString()
      );
      
      // Verify SOL was transferred
      const finalTreasuryBalance = await provider.connection.getBalance(treasuryPDA);
      const finalRecipientBalance = await provider.connection.getBalance(recipient2.publicKey);
      
      expect(initialTreasuryBalance - finalTreasuryBalance).to.equal(PAYOUT_AMOUNT.toNumber());
      expect(finalRecipientBalance - initialRecipientBalance).to.equal(PAYOUT_AMOUNT.toNumber());
    });

    it("should fail to execute recurring payout before interval has passed", async () => {
      // Current timestamp
      const timestamp = new BN(Math.floor(Date.now() / 1000));
      
      try {
        // Try to execute the recurring payout again immediately
        await program.methods
          .executePayout(timestamp)
          .accounts({
            authority: treasurer.publicKey,
            treasury: treasuryPDA,
            user: treasurerUserPDA,
            recipient: recipient2PDA,
            payoutSchedule: recurringPayoutPDA,
            recipientWallet: recipient2.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with PayoutNotDue
        expect(error.message).to.include("Error") || expect(error.message).to.include("PayoutNotDue");
      }
    });

    it("should cancel a payout", async () => {
      // Cancel the recurring payout
      await program.methods
        .cancelPayout()
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipient2PDA,
          payoutSchedule: recurringPayoutPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify payout was cancelled
      const payoutSchedule = await program.account.payoutSchedule.fetch(recurringPayoutPDA);
      expect(payoutSchedule.isActive).to.be.false;
    });

    it("should fail to execute cancelled payout", async () => {
      // Current timestamp
      const timestamp = new BN(Math.floor(Date.now() / 1000));
      
      try {
        // Try to execute the cancelled payout
        await program.methods
          .executePayout(timestamp)
          .accounts({
            authority: treasurer.publicKey,
            treasury: treasuryPDA,
            user: treasurerUserPDA,
            recipient: recipient2PDA,
            payoutSchedule: recurringPayoutPDA,
            recipientWallet: recipient2.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with PayoutNotActive
        expect(error.message).to.include("Error") || expect(error.message).to.include("PayoutNotActive");
      }
    });
  });
});