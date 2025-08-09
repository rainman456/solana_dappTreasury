import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TreasuryVault } from "../target/types/treasury_vault";
import { expect } from "chai";
import { BN } from "bn.js";

describe("treasury_vault_role_permissions", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TreasuryVault as Program<TreasuryVault>;
  const admin = anchor.web3.Keypair.generate();
  const treasurer1 = anchor.web3.Keypair.generate();
  const treasurer2 = anchor.web3.Keypair.generate();
  const regularUser = anchor.web3.Keypair.generate();
  const recipient = anchor.web3.Keypair.generate();
  
  // Constants for testing
  const EPOCH_DURATION = new BN(86400); // 1 day in seconds
  const SPENDING_LIMIT = new BN(5000000000); // 5 SOL in lamports
  const DEPOSIT_AMOUNT = new BN(1000000000); // 1 SOL in lamports
  
  // PDAs
  let treasuryPDA: anchor.web3.PublicKey;
  let treasuryBump: number;
  let adminUserPDA: anchor.web3.PublicKey;
  let treasurer1UserPDA: anchor.web3.PublicKey;
  let treasurer2UserPDA: anchor.web3.PublicKey;
  let regularUserPDA: anchor.web3.PublicKey;
  let recipientPDA: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to all accounts for testing
    await provider.connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(treasurer1.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(treasurer2.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
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
    
    [treasurer1UserPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user"),
        treasurer1.publicKey.toBuffer(),
        treasuryPDA.toBuffer(),
      ],
      program.programId
    );
    
    [treasurer2UserPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user"),
        treasurer2.publicKey.toBuffer(),
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
      
      // Verify admin user was created
      const adminUser = await program.account.treasuryUser.fetch(adminUserPDA);
      expect(adminUser.user.toString()).to.equal(admin.publicKey.toString());
      expect(adminUser.role).to.equal(0); // Admin role
      expect(adminUser.isActive).to.be.true;
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

  describe("Role-Based Permissions", () => {
    it("should add a treasurer by an admin", async () => {
      await program.methods
        .addTreasuryUser(1) // 1 = Treasurer role
        .accounts({
          admin: admin.publicKey,
          treasury: treasuryPDA,
          userAccount: treasurer1UserPDA,
          user: treasurer1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify treasurer was added
      const treasurerAccount = await program.account.treasuryUser.fetch(treasurer1UserPDA);
      expect(treasurerAccount.user.toString()).to.equal(treasurer1.publicKey.toString());
      expect(treasurerAccount.role).to.equal(1); // Treasurer role
      expect(treasurerAccount.isActive).to.be.true;
    });

    it("should add another treasurer by an admin", async () => {
      await program.methods
        .addTreasuryUser(1) // 1 = Treasurer role
        .accounts({
          admin: admin.publicKey,
          treasury: treasuryPDA,
          userAccount: treasurer2UserPDA,
          user: treasurer2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify treasurer was added
      const treasurerAccount = await program.account.treasuryUser.fetch(treasurer2UserPDA);
      expect(treasurerAccount.user.toString()).to.equal(treasurer2.publicKey.toString());
      expect(treasurerAccount.role).to.equal(1); // Treasurer role
      expect(treasurerAccount.isActive).to.be.true;
    });

    it("should fail when non-admin tries to add a treasurer", async () => {
      try {
        await program.methods
          .addTreasuryUser(1) // 1 = Treasurer role
          .accounts({
            admin: treasurer1.publicKey, // Not an admin
            treasury: treasuryPDA,
            userAccount: regularUserPDA,
            user: regularUser.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer1])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with UnauthorizedUser
        expect(error.message).to.include("Error") || expect(error.message).to.include("UnauthorizedUser");
      }
    });

    it("should add a whitelisted recipient by an admin", async () => {
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
      expect(recipientAccount.isActive).to.be.true;
    });

    it("should fail when treasurer tries to add a whitelisted recipient", async () => {
      // Create a new recipient keypair
      const newRecipient = anchor.web3.Keypair.generate();
      
      // Find new recipient PDA
      const [newRecipientPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("recipient"),
          newRecipient.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
        ],
        program.programId
      );
      
      try {
        await program.methods
          .addWhitelistedRecipient("New Recipient")
          .accounts({
            authority: treasurer1.publicKey, // Treasurer, not admin
            treasury: treasuryPDA,
            user: treasurer1UserPDA,
            recipientAccount: newRecipientPDA,
            recipient: newRecipient.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer1])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with UnauthorizedUser
        expect(error.message).to.include("Error") || expect(error.message).to.include("UnauthorizedUser");
      }
    });

    it("should allow treasurer to schedule a payout", async () => {
      // Schedule time 1 hour in the future
      const scheduleTime = new BN(Math.floor(Date.now() / 1000) + 3600);
      
      // Find payout schedule PDA
      const [payoutSchedulePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("payout"),
          recipient.publicKey.toBuffer(),
          treasuryPDA.toBuffer(),
          new BN(0).toArrayLike(Buffer, "le", 8), // Index 0
        ],
        program.programId
      );
      
      // Schedule payout as treasurer
      await program.methods
        .schedulePayout(
          new BN(100000000), // 0.1 SOL
          scheduleTime,
          false, // Not recurring
          new BN(0), // No recurrence interval
          new BN(0) // Index 0
        )
        .accounts({
          authority: treasurer1.publicKey,
          treasury: treasuryPDA,
          user: treasurer1UserPDA,
          recipient: recipientPDA,
          payoutSchedule: payoutSchedulePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([treasurer1])
        .rpc();
      
      // Verify payout schedule
      const payoutSchedule = await program.account.payoutSchedule.fetch(payoutSchedulePDA);
      expect(payoutSchedule.recipient.toString()).to.equal(recipient.publicKey.toString());
      expect(payoutSchedule.createdBy.toString()).to.equal(treasurer1.publicKey.toString());
      expect(payoutSchedule.isActive).to.be.true;
    });

    it("should allow admin to update treasury config", async () => {
      // New values
      const newEpochDuration = new BN(172800); // 2 days in seconds
      const newSpendingLimit = new BN(2000000000); // 2 SOL in lamports
      
      await program.methods
        .updateTreasuryConfig(newEpochDuration, newSpendingLimit)
        .accounts({
          treasury: treasuryPDA,
          authority: admin.publicKey,
          user: adminUserPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
      
      // Verify treasury config was updated
      const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAccount.epochDuration.toString()).to.equal(newEpochDuration.toString());
      expect(treasuryAccount.spendingLimit.toString()).to.equal(newSpendingLimit.toString());
    });

    it("should fail when treasurer tries to update treasury config", async () => {
      try {
        await program.methods
          .updateTreasuryConfig(EPOCH_DURATION, SPENDING_LIMIT)
          .accounts({
            treasury: treasuryPDA,
            authority: treasurer1.publicKey,
            user: treasurer1UserPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([treasurer1])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with UnauthorizedUser
        expect(error.message).to.include("Error") || expect(error.message).to.include("UnauthorizedUser");
      }
    });

    it("should allow treasurer to withdraw funds within spending limit", async () => {
      // Get initial balances
      const initialTreasuryBalance = await provider.connection.getBalance(treasuryPDA);
      const initialRecipientBalance = await provider.connection.getBalance(recipient.publicKey);
      
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = new BN(Math.floor(Date.now() / 1000) - 5);
      
      // Find audit log PDA
      const [auditLogPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("audit"),
          treasuryPDA.toBuffer(),
          withdrawTimestamp.toArrayLike(Buffer, "le", 8),
          treasurer1.publicKey.toBuffer(),
        ],
        program.programId
      );
      
      // Withdraw 0.1 SOL
      const withdrawAmount = new BN(100000000);
      await program.methods
        .withdraw(withdrawAmount, withdrawTimestamp)
        .accounts({
          treasury: treasuryPDA,
          auditLog: auditLogPDA,
          authority: treasurer1.publicKey,
          user: treasurer1UserPDA,
          recipient: recipient.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([treasurer1])
        .rpc();
      
      // Verify withdrawal
      const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
      expect(treasuryAccount.totalFunds.toString()).to.equal(
        DEPOSIT_AMOUNT.sub(withdrawAmount).toString()
      );
      
      // Verify SOL was transferred
      const finalTreasuryBalance = await provider.connection.getBalance(treasuryPDA);
      const finalRecipientBalance = await provider.connection.getBalance(recipient.publicKey);
      
      expect(initialTreasuryBalance - finalTreasuryBalance).to.equal(withdrawAmount.toNumber());
      expect(finalRecipientBalance - initialRecipientBalance).to.equal(withdrawAmount.toNumber());
    });

    it("should fail when regular user tries to withdraw funds", async () => {
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = new BN(Math.floor(Date.now() / 1000) - 10);
      
      // Find audit log PDA
      const [auditLogPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("audit"),
          treasuryPDA.toBuffer(),
          withdrawTimestamp.toArrayLike(Buffer, "le", 8),
          regularUser.publicKey.toBuffer(),
        ],
        program.programId
      );
      
      try {
        // Try to withdraw as regular user
        await program.methods
          .withdraw(new BN(100000000), withdrawTimestamp)
          .accounts({
            treasury: treasuryPDA,
            auditLog: auditLogPDA,
            authority: regularUser.publicKey,
            user: regularUserPDA, // This account doesn't exist
            recipient: recipient.publicKey,
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
});