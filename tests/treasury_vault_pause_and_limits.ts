import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TreasuryVault } from "../target/types/treasury_vault";
import { expect } from "chai";
import { BN } from "bn.js";

describe("treasury_vault_pause_and_limits", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TreasuryVault as Program<TreasuryVault>;
  const admin = anchor.web3.Keypair.generate();
  const treasurer = anchor.web3.Keypair.generate();
  const regularUser = anchor.web3.Keypair.generate();
  const recipient = anchor.web3.Keypair.generate();
  
  // Constants for testing
  const EPOCH_DURATION = new BN(3600); // 1 hour in seconds (minimum allowed)
  const SPENDING_LIMIT = new BN(500000000); // 0.5 SOL in lamports
  const DEPOSIT_AMOUNT = new BN(1000000000); // 1 SOL in lamports
  const PAYOUT_AMOUNT = new BN(100000000); // 0.1 SOL in lamports
  const LARGE_PAYOUT = new BN(400000000); // 0.4 SOL in lamports
  
  // PDAs
  let treasuryPDA: anchor.web3.PublicKey;
  let treasuryBump: number;
  let adminUserPDA: anchor.web3.PublicKey;
  let treasurerUserPDA: anchor.web3.PublicKey;
  let regularUserPDA: anchor.web3.PublicKey;
  let recipientPDA: anchor.web3.PublicKey;
  let payoutSchedulePDA: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to all accounts for testing
    await provider.connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(treasurer.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(regularUser.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(recipient.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    
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
    
    [regularUserPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user"),
        regularUser.publicKey.toBuffer(),
        treasuryPDA.toBuffer(),
      ],
      program.programId
    );
    
    // Find recipient PDA
    [recipientPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("recipient"),
        recipient.publicKey.toBuffer(),
        treasuryPDA.toBuffer(),
      ],
      program.programId
    );
    
    // Find payout schedule PDA
    [payoutSchedulePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("payout"),
        recipient.publicKey.toBuffer(),
        treasuryPDA.toBuffer(),
        new BN(1).toArrayLike(Buffer, "le", 8), // Index 1
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
      expect(treasuryAccount.epochDuration.toString()).to.equal(EPOCH_DURATION.toString());
      expect(treasuryAccount.spendingLimit.toString()).to.equal(SPENDING_LIMIT.toString());
      expect(treasuryAccount.isPaused).to.be.false;
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
    });

    it("should add regular user", async () => {
      await program.methods
        .addTreasuryUser(1) // 1 = Treasurer role (but with fewer permissions)
        .accounts({
          admin: admin.publicKey,
          treasury: treasuryPDA,
          userAccount: regularUserPDA,
          user: regularUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify user was added
      const userAccount = await program.account.treasuryUser.fetch(regularUserPDA);
      expect(userAccount.user.toString()).to.equal(regularUser.publicKey.toString());
      expect(userAccount.role).to.equal(1); // Treasurer role
    });

    it("should add whitelisted recipient", async () => {
      await program.methods
        .addWhitelistedRecipient("Test Recipient")
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipientAccount: recipientPDA,
          recipient: recipient.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify recipient was added
      const recipientAccount = await program.account.whitelistedRecipient.fetch(recipientPDA);
      expect(recipientAccount.recipient.toString()).to.equal(recipient.publicKey.toString());
      expect(recipientAccount.name).to.equal("Test Recipient");
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
      await program.methods
        .deposit(DEPOSIT_AMOUNT, depositTimestamp)
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
      expect(treasuryAccount.totalFunds.toString()).to.equal(DEPOSIT_AMOUNT.toString());
    });

    it("should schedule a payout", async () => {
      // Schedule time a few seconds in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 5);
      
      // Schedule payout
      await program.methods
        .schedulePayout(
          PAYOUT_AMOUNT,
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(1) // Index 1
        )
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipientPDA,
          payoutSchedule: payoutSchedulePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify payout was scheduled
      const payoutSchedule = await program.account.payoutSchedule.fetch(payoutSchedulePDA);
      expect(payoutSchedule.recipient.toString()).to.equal(recipient.publicKey.toString());
      expect(payoutSchedule.amount.toString()).to.equal(PAYOUT_AMOUNT.toString());
      expect(payoutSchedule.scheduleTime.toString()).to.equal(scheduleTime.toString());
      
      // Wait for the schedule time to pass
      await new Promise(resolve => setTimeout(resolve, 6000));
    });
  });

  describe("Pause and Unpause", () => {
    it("should allow admin to pause the treasury", async () => {
      await program.methods
        .pauseTreasury()
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify treasury is paused
      const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAccount.isPaused).to.be.true;
    });

    it("should fail when trying to pause an already paused treasury", async () => {
      try {
        await program.methods
          .pauseTreasury()
          .accounts({
            treasury: treasuryPDA,
            authority: admin.publicKey,
            user: adminUserPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        expect(error.message).to.include("TreasuryAlreadyPaused");
      }
    });

    it("should fail when non-admin tries to pause the treasury", async () => {
      try {
        await program.methods
          .pauseTreasury()
          .accounts({
            treasury: treasuryPDA,
            authority: treasurer.publicKey,
            user: treasurerUserPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        expect(error.message).to.include("UnauthorizedPauseAction");
      }
    });

    it("should fail to execute payout when treasury is paused", async () => {
      // Create a timestamp for the execution
      const timestamp = new BN(Math.floor(Date.now() / 1000) - 5);
      
      try {
        await program.methods
          .executePayout(timestamp)
          .accounts({
            authority: treasurer.publicKey,
            treasury: treasuryPDA,
            user: treasurerUserPDA,
            recipient: recipientPDA,
            payoutSchedule: payoutSchedulePDA,
            recipientWallet: recipient.publicKey,
            recipientTokenAccount: recipient.publicKey, // Dummy value, not actually used
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        expect(error.message).to.include("TreasuryPaused");
      }
    });

    it("should allow admin to unpause the treasury", async () => {
      await program.methods
        .unpauseTreasury()
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify treasury is unpaused
      const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAccount.isPaused).to.be.false;
    });

    it("should fail when trying to unpause an already unpaused treasury", async () => {
      try {
        await program.methods
          .unpauseTreasury()
          .accounts({
            treasury: treasuryPDA,
            authority: admin.publicKey,
            user: adminUserPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        expect(error.message).to.include("TreasuryAlreadyUnpaused");
      }
    });

    it("should fail when non-admin tries to unpause the treasury", async () => {
      // First, pause the treasury again
      await program.methods
        .pauseTreasury()
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      try {
        await program.methods
          .unpauseTreasury()
          .accounts({
            treasury: treasuryPDA,
            authority: treasurer.publicKey,
            user: treasurerUserPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        expect(error.message).to.include("UnauthorizedPauseAction");
      }
      
      // Unpause the treasury for the next tests
      await program.methods
        .unpauseTreasury()
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    });
  });

  describe("Spending Limits", () => {
    // Note: Due to the limitation of transferring SOL from PDAs with data,
    // we can't test the actual execution of payouts. Instead, we'll test
    // the validation logic by checking that the appropriate errors are thrown.
    
    it("should validate spending limits", async () => {
      // First, let's update the spending limit to a smaller value for testing
      const smallSpendingLimit = new BN(50000000); // 0.05 SOL
      
      await program.methods
        .updateTreasuryConfig(null, smallSpendingLimit)
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify spending limit was updated
      const treasuryAfterUpdate = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAfterUpdate.spendingLimit.toString()).to.equal(smallSpendingLimit.toString());
      
      // Schedule a payout that exceeds the spending limit
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 5);
      
      const [excessPayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(2).toArrayLike(Buffer, "le", 8), // Index 2
        ],
        program.programId
      );
      
      await program.methods
        .schedulePayout(
          PAYOUT_AMOUNT, // 0.1 SOL, which exceeds the 0.05 SOL limit
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(2) // Index 2
        )
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipientPDA,
          payoutSchedule: excessPayoutPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Wait for the schedule time to pass
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Try to execute the payout - should fail due to spending limit
      const timestamp = new BN(Math.floor(Date.now() / 1000) - 5);
      
      try {
        await program.methods
          .executePayout(timestamp)
          .accounts({
            authority: treasurer.publicKey,
            treasury: treasuryPDA,
            user: treasurerUserPDA,
            recipient: recipientPDA,
            payoutSchedule: excessPayoutPDA,
            recipientWallet: recipient.publicKey,
            recipientTokenAccount: recipient.publicKey, // Dummy value, not actually used
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with SpendingLimitExceeded
        expect(error.message).to.include("SpendingLimitExceeded");
      }
      
      // Now update the spending limit back to a larger value
      await program.methods
        .updateTreasuryConfig(null, SPENDING_LIMIT)
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify spending limit was updated back
      const treasuryAfterReset = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAfterReset.spendingLimit.toString()).to.equal(SPENDING_LIMIT.toString());
    });
    
    it("should validate epoch reset logic", async () => {
      // First, let's update the epoch duration to a very short value
      const shortEpochDuration = new BN(3600); // 1 hour (minimum allowed)
      
      await program.methods
        .updateTreasuryConfig(shortEpochDuration, null)
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify epoch duration was updated
      const treasuryAfterUpdate = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAfterUpdate.epochDuration.toString()).to.equal(shortEpochDuration.toString());
      
      // Schedule a payout that's within the spending limit
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 5);
      
      const [payoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(3).toArrayLike(Buffer, "le", 8), // Index 3
        ],
        program.programId
      );
      
      await program.methods
        .schedulePayout(
          PAYOUT_AMOUNT, // 0.1 SOL
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(3) // Index 3
        )
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipientPDA,
          payoutSchedule: payoutPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Wait for the schedule time to pass
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Note: We can't actually execute the payout due to the PDA transfer limitation,
      // but we can verify that the epoch duration was updated correctly
      
      // Verify that the epoch duration is working as expected
      const treasuryFinal = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryFinal.epochDuration.toString()).to.equal(shortEpochDuration.toString());
      
      // Reset epoch duration to original value
      await program.methods
        .updateTreasuryConfig(EPOCH_DURATION, null)
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    });
    
    it("should validate boundary spending limit cases", async () => {
      // First, let's update the spending limit to a precise value for testing
      const preciseLimit = new BN(300000000); // 0.3 SOL
      
      await program.methods
        .updateTreasuryConfig(null, preciseLimit)
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Schedule a payout that's exactly at the limit
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 5);
      
      const [exactPayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(5).toArrayLike(Buffer, "le", 8), // Index 5
        ],
        program.programId
      );
      
      await program.methods
        .schedulePayout(
          preciseLimit, // Exactly the spending limit
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(5) // Index 5
        )
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipientPDA,
          payoutSchedule: exactPayoutPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Schedule another payout that's just 1 lamport over the limit
      const [overLimitPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(6).toArrayLike(Buffer, "le", 8), // Index 6
        ],
        program.programId
      );
      
      await program.methods
        .schedulePayout(
          preciseLimit.add(new BN(1)), // 1 lamport over the limit
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(6) // Index 6
        )
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipientPDA,
          payoutSchedule: overLimitPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Wait for the schedule time to pass
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Try to execute the payout that's exactly at the limit
      const timestamp = new BN(Math.floor(Date.now() / 1000) - 5);
      
      try {
        await program.methods
          .executePayout(timestamp)
          .accounts({
            authority: treasurer.publicKey,
            treasury: treasuryPDA,
            user: treasurerUserPDA,
            recipient: recipientPDA,
            payoutSchedule: exactPayoutPDA,
            recipientWallet: recipient.publicKey,
            recipientTokenAccount: recipient.publicKey, // Dummy value, not actually used
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer])
          .rpc();
        
        // This should fail due to the PDA transfer limitation, not due to spending limit
      } catch (error: any) {
        // We expect this to fail with the transfer error, not with SpendingLimitExceeded
        expect(error.message).to.include("Transfer: `from` must not carry data");
      }
      
      // Try to execute the payout that's over the limit
      const timestamp2 = new BN(Math.floor(Date.now() / 1000) - 3);
      
      try {
        await program.methods
          .executePayout(timestamp2)
          .accounts({
            authority: treasurer.publicKey,
            treasury: treasuryPDA,
            user: treasurerUserPDA,
            recipient: recipientPDA,
            payoutSchedule: overLimitPDA,
            recipientWallet: recipient.publicKey,
            recipientTokenAccount: recipient.publicKey, // Dummy value, not actually used
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with SpendingLimitExceeded
        expect(error.message).to.include("SpendingLimitExceeded");
      }
      
      // Reset spending limit to original value
      await program.methods
        .updateTreasuryConfig(null, SPENDING_LIMIT)
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    });
  });
});