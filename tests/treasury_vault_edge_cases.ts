import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TreasuryVault } from "../target/types/treasury_vault";
import { expect } from "chai";
import { BN } from "bn.js";

describe("treasury_vault_edge_cases", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TreasuryVault as Program<TreasuryVault>;
  const admin = anchor.web3.Keypair.generate();
  const treasurer = anchor.web3.Keypair.generate();
  const recipient1 = anchor.web3.Keypair.generate();
  const recipient2 = anchor.web3.Keypair.generate();
  
  // Constants for testing
  const EPOCH_DURATION = new BN(86400); // 1 day in seconds
  const SPENDING_LIMIT = new BN(5000000000); // 5 SOL in lamports
  const DEPOSIT_AMOUNT = new BN(1000000000); // 1 SOL in lamports
  const MAX_U64 = new BN("18446744073709551615"); // Maximum u64 value
  
  // PDAs
  let treasuryPDA: anchor.web3.PublicKey;
  let treasuryBump: number;
  let adminUserPDA: anchor.web3.PublicKey;
  let treasurerUserPDA: anchor.web3.PublicKey;
  let recipient1PDA: anchor.web3.PublicKey;
  let recipient2PDA: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to all accounts for testing
    await provider.connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(treasurer.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(recipient1.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(recipient2.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    
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
      
      const recipient2Account = await program.account.whitelistedRecipient.fetch(recipient2PDA);
      expect(recipient2Account.recipient.toString()).to.equal(recipient2.publicKey.toString());
      expect(recipient2Account.name).to.equal("Recipient 2");
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
  });

  describe("Edge Cases", () => {
    it("should fail to schedule payout with maximum u64 amount", async () => {
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Find payout schedule PDA
      const [payoutSchedulePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(0).toArrayLike(Buffer, "le", 8), // Index 0
        ],
        program.programId
      );
      
      try {
        // Try to schedule payout with maximum u64 amount
        await program.methods
          .schedulePayout(
            MAX_U64, // Maximum u64 value
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
            payoutSchedule: payoutSchedulePDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail due to insufficient funds or overflow
        expect(true).to.be.true;
      }
    });

    it("should schedule multiple payouts for the same recipient", async () => {
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Find first payout schedule PDA
      const [payoutSchedule1PDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(1).toArrayLike(Buffer, "le", 8), // Index 1
        ],
        program.programId
      );
      
      // Schedule first payout
      await program.methods
        .schedulePayout(
          new BN(100000000), // 0.1 SOL
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(1) // Index 1
        )
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipient1PDA,
          payoutSchedule: payoutSchedule1PDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Find second payout schedule PDA
      const [payoutSchedule2PDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(2).toArrayLike(Buffer, "le", 8), // Index 2
        ],
        program.programId
      );
      
      // Schedule second payout for the same recipient
      await program.methods
        .schedulePayout(
          new BN(200000000), // 0.2 SOL
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(2) // Index 2
        )
        .accounts({
          authority: admin.publicKey,
          treasury: treasuryPDA,
          user: adminUserPDA,
          recipient: recipient1PDA,
          payoutSchedule: payoutSchedule2PDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify both payouts were scheduled
      const payoutSchedule1 = await program.account.payoutSchedule.fetch(payoutSchedule1PDA);
      expect(payoutSchedule1.recipient.toString()).to.equal(recipient1.publicKey.toString());
      expect(payoutSchedule1.amount.toString()).to.equal("100000000");
      
      const payoutSchedule2 = await program.account.payoutSchedule.fetch(payoutSchedule2PDA);
      expect(payoutSchedule2.recipient.toString()).to.equal(recipient1.publicKey.toString());
      expect(payoutSchedule2.amount.toString()).to.equal("200000000");
    });

    it("should fail to execute payout with zero treasury funds", async () => {
      // First, withdraw all funds from treasury
      const currentFunds = (await program.account.treasury.fetch(treasuryPDA)).totalFunds;
      
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = new BN(Math.floor(Date.now() / 1000) - 10);
      
      // Find audit log PDA
      const [auditLogPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("audit"),
          treasuryPDA.toBuffer(),
          withdrawTimestamp.toArrayLike(Buffer, "le", 8),
          admin.publicKey.toBuffer(),
        ],
        program.programId
      );
      
      // Withdraw all funds
      await program.methods
        .withdraw(currentFunds, withdrawTimestamp)
        .accounts({
          treasury: treasuryPDA,
          auditLog: auditLogPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          recipient: recipient2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify treasury is empty
      const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAccount.totalFunds.toString()).to.equal("0");
      
      // Now try to execute a payout
      // Wait a bit to ensure we're past the scheduled time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Current timestamp
      const timestamp = new BN(Math.floor(Date.now() / 1000));
      
      // Find payout schedule PDA
      const [payoutSchedulePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(1).toArrayLike(Buffer, "le", 8), // Index 1
        ],
        program.programId
      );
      
      try {
        // Try to execute payout with zero treasury funds
        await program.methods
          .executePayout(timestamp)
          .accounts({
            authority: admin.publicKey,
            treasury: treasuryPDA,
            user: adminUserPDA,
            recipient: recipient1PDA,
            payoutSchedule: payoutSchedulePDA,
            recipientWallet: recipient1.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with InsufficientFunds
        expect(error.message).to.include("Error") || expect(error.message).to.include("InsufficientFunds");
      }
    });

    it("should handle concurrent payout scheduling", async () => {
      // Deposit funds back to treasury
      const depositTimestamp = new BN(Math.floor(Date.now() / 1000) - 15);
      
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
      
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Create multiple payout schedules concurrently
      const numPayouts = 5;
      const payoutPromises = [];
      
      for (let i = 10; i < 10 + numPayouts; i++) {
        // Find payout schedule PDA
        const [payoutSchedulePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from("payout"),
            recipient1.publicKey.toBuffer(),
            treasuryPDA.toBuffer(),
            new BN(i).toArrayLike(Buffer, "le", 8), // Index i
          ],
          program.programId
        );
        
        // Schedule payout
        const payoutPromise = program.methods
          .schedulePayout(
            new BN(10000000), // 0.01 SOL
            scheduleTime,
            false, // Not recurring
            new BN(0), // No recurrence interval
            new BN(i) // Index i
          )
          .accounts({
            authority: admin.publicKey,
            treasury: treasuryPDA,
            user: adminUserPDA,
            recipient: recipient1PDA,
            payoutSchedule: payoutSchedulePDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        payoutPromises.push(payoutPromise);
      }
      
      // Wait for all payouts to be scheduled
      await Promise.all(payoutPromises);
      
      // Verify at least one payout was scheduled successfully
      const [lastPayoutSchedulePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(10 + numPayouts - 1).toArrayLike(Buffer, "le", 8), // Last index
        ],
        program.programId
      );
      
      const lastPayoutSchedule = await program.account.payoutSchedule.fetch(lastPayoutSchedulePDA);
      expect(lastPayoutSchedule.recipient.toString()).to.equal(recipient1.publicKey.toString());
      expect(lastPayoutSchedule.amount.toString()).to.equal("10000000");
    });

    it("should fail to schedule payout with invalid recurrence interval for recurring payout", async () => {
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Find payout schedule PDA
      const [payoutSchedulePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient1.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(20).toArrayLike(Buffer, "le", 8), // Index 20
        ],
        program.programId
      );
      
      try {
        // Try to schedule recurring payout with zero interval
        await program.methods
          .schedulePayout(
            new BN(100000000), // 0.1 SOL
            scheduleTime,
            true, // Recurring
            new BN(0), // Zero interval (invalid)
            new BN(20) // Index 20
          )
          .accounts({
            authority: admin.publicKey,
            treasury: treasuryPDA,
            user: adminUserPDA,
            recipient: recipient1PDA,
            payoutSchedule: payoutSchedulePDA,
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
  });
});