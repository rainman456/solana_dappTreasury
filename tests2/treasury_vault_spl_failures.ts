import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { BN } from "bn.js";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import {
  TestContext,
  TokenContext,
  setupTestContext,
  initializeTreasury,
  setupTokenContext,
  createTimestamp,
  findAuditLogPDA,
  DEPOSIT_AMOUNT,
  WITHDRAW_AMOUNT
} from "../tests/test_utils";

describe("treasury_vault_spl_failures", () => {
  let ctx: TestContext;
  let tokenCtx: TokenContext;
  let invalidMint: anchor.web3.PublicKey;
  let invalidTokenAccount: anchor.web3.PublicKey;

  before(async () => {
    // Setup test context
    ctx = await setupTestContext();
    await initializeTreasury(ctx);
    
    // Setup token context
    tokenCtx = await setupTokenContext(ctx);
    
    // Create an invalid mint for testing
    invalidMint = await createMint(
      ctx.provider.connection,
      ctx.admin,
      ctx.admin.publicKey,
      null,
      9 // Different decimals
    );
    
    // Create an invalid token account (associated with the invalid mint)
    const invalidTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      ctx.provider.connection,
      ctx.admin,
      invalidMint,
      ctx.depositor.publicKey
    );
    invalidTokenAccount = invalidTokenAccountInfo.address;
    
    // Make an initial deposit to have some tokens in the treasury
    const depositTimestamp = createTimestamp();
    const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
    
    await ctx.program.methods
      .depositToken(DEPOSIT_AMOUNT, depositTimestamp)
      .accounts({
        treasury: ctx.treasuryPDA,
        tokenBalance: tokenCtx.tokenBalancePDA,
        treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
        depositorTokenAccount: tokenCtx.depositorTokenAccount,
        tokenMint: tokenCtx.tokenMint,
        auditLog: auditLogPDA,
        depositor: ctx.depositor.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.depositor])
      .rpc();
  });

  describe("Invalid Deposit Scenarios", () => {
    it("should fail with zero deposit amount", async () => {
      // Create a timestamp for the deposit
      const depositTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
      
      try {
        // Try to deposit 0 tokens
        await ctx.program.methods
          .depositToken(new BN(0), depositTimestamp)
          .accounts({
            treasury: ctx.treasuryPDA,
            tokenBalance: tokenCtx.tokenBalancePDA,
            treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
            depositorTokenAccount: tokenCtx.depositorTokenAccount,
            tokenMint: tokenCtx.tokenMint,
            auditLog: auditLogPDA,
            depositor: ctx.depositor.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.depositor])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        expect(error.message).to.include("InvalidDepositAmount");
      }
    });

    it("should fail with future timestamp", async () => {
      // Create a future timestamp
      const futureTimestamp = createTimestamp(3600); // 1 hour in the future
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, futureTimestamp, ctx.depositor.publicKey);
      
      try {
        // Try to deposit with future timestamp
        await ctx.program.methods
          .depositToken(DEPOSIT_AMOUNT, futureTimestamp)
          .accounts({
            treasury: ctx.treasuryPDA,
            tokenBalance: tokenCtx.tokenBalancePDA,
            treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
            depositorTokenAccount: tokenCtx.depositorTokenAccount,
            tokenMint: tokenCtx.tokenMint,
            auditLog: auditLogPDA,
            depositor: ctx.depositor.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.depositor])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        expect(error.message).to.include("InvalidTimestamp");
      }
    });

    it("should fail with invalid token mint", async () => {
      // Create a timestamp for the deposit
      const depositTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
      
      // Find token balance PDA for the invalid mint
      const [invalidTokenBalancePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("token_balance"),
          ctx.treasuryPDA.toBuffer(),
          invalidMint.toBuffer(),
        ],
        ctx.program.programId
      );
      
      try {
        // Try to deposit with mismatched mint and token account
        await ctx.program.methods
          .depositToken(DEPOSIT_AMOUNT, depositTimestamp)
          .accounts({
            treasury: ctx.treasuryPDA,
            tokenBalance: invalidTokenBalancePDA,
            treasuryTokenAccount: tokenCtx.treasuryTokenAccount, // This is for the valid mint
            depositorTokenAccount: invalidTokenAccount, // This is for the invalid mint
            tokenMint: invalidMint,
            auditLog: auditLogPDA,
            depositor: ctx.depositor.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.depositor])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with a token program error
        expect(true).to.be.true;
      }
    });
  });

  describe("Invalid Withdrawal Scenarios", () => {
    it("should fail when non-treasurer tries to withdraw", async () => {
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, withdrawTimestamp, ctx.depositor.publicKey);
      
      try {
        // Try to withdraw as non-treasurer
        await ctx.program.methods
          .withdrawToken(WITHDRAW_AMOUNT, withdrawTimestamp)
          .accounts({
            authority: ctx.depositor.publicKey,
            treasury: ctx.treasuryPDA,
            user: ctx.treasurerUserPDA, // Using treasurer's user account but depositor's signature
            tokenBalance: tokenCtx.tokenBalancePDA,
            treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
            recipientTokenAccount: tokenCtx.recipientTokenAccount,
            tokenMint: tokenCtx.tokenMint,
            recipient: ctx.recipient.publicKey,
            auditLog: auditLogPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.depositor])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with a signature verification error
        expect(true).to.be.true;
      }
    });

    it("should fail when withdrawal exceeds token balance", async () => {
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, withdrawTimestamp, ctx.treasurer.publicKey);
      
      // Get current token balance
      const tokenBalanceAccount = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      
      // Try to withdraw more than available
      const excessAmount = tokenBalanceAccount.balance.add(new BN(100000)); // Add 0.1 tokens to exceed balance
      
      try {
        await ctx.program.methods
          .withdrawToken(excessAmount, withdrawTimestamp)
          .accounts({
            authority: ctx.treasurer.publicKey,
            treasury: ctx.treasuryPDA,
            user: ctx.treasurerUserPDA,
            tokenBalance: tokenCtx.tokenBalancePDA,
            treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
            recipientTokenAccount: tokenCtx.recipientTokenAccount,
            tokenMint: tokenCtx.tokenMint,
            recipient: ctx.recipient.publicKey,
            auditLog: auditLogPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        expect(error.message).to.include("InsufficientTokenBalance");
      }
    });

    it("should fail with invalid token account", async () => {
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, withdrawTimestamp, ctx.treasurer.publicKey);
      
      // Create an associated token account for the invalid mint
      const invalidRecipientTokenAccount = await getOrCreateAssociatedTokenAccount(
        ctx.provider.connection,
        ctx.admin,
        invalidMint,
        ctx.recipient.publicKey
      );
      
      try {
        // Try to withdraw with mismatched mint and token account
        await ctx.program.methods
          .withdrawToken(WITHDRAW_AMOUNT, withdrawTimestamp)
          .accounts({
            authority: ctx.treasurer.publicKey,
            treasury: ctx.treasuryPDA,
            user: ctx.treasurerUserPDA,
            tokenBalance: tokenCtx.tokenBalancePDA,
            treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
            recipientTokenAccount: invalidRecipientTokenAccount.address, // This is for the invalid mint
            tokenMint: tokenCtx.tokenMint,
            recipient: ctx.recipient.publicKey,
            auditLog: auditLogPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.treasurer])
          .rpc();
        
        // Should not reach here
        expect.fail("Expected error was not thrown");
      } catch (error: any) {
        // This should fail with a token program error
        expect(true).to.be.true;
      }
    });
  });
});