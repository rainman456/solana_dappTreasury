import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { BN } from "bn.js";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import {
  TestContext,
  TokenContext,
  setupTestContext,
  initializeTreasury,
  setupTokenContext,
  createTimestamp,
  findAuditLogPDA
} from "./test_utils";

describe("treasury_vault_spl_edge_cases", () => {
  let ctx: TestContext;
  let tokenCtx: TokenContext;
  let secondTokenCtx: TokenContext;

  before(async () => {
    // Setup test context
    ctx = await setupTestContext();
    await initializeTreasury(ctx);
    
    // Setup first token context (6 decimals like USDC)
    tokenCtx = await setupTokenContext(ctx, 6);
    
    // Setup second token context (9 decimals like SOL)
    secondTokenCtx = await setupTokenContext(ctx, 9);
  });

  describe("Exact Balance Operations", () => {
    it("should deposit and withdraw exact balance", async () => {
      // Create a timestamp for the deposit
      const depositTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
      
      // Deposit exact amount (100,000 with 6 decimals = 0.1 tokens)
      const exactAmount = new BN(100000);
      
      await ctx.program.methods
        .depositToken(exactAmount, depositTimestamp)
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
      
      // Verify token balance
      const tokenBalanceAccount = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      expect(tokenBalanceAccount.balance.toString()).to.equal(exactAmount.toString());
      
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = createTimestamp();
      
      // Find audit log PDA for withdrawal
      const withdrawAuditLogPDA = await findAuditLogPDA(ctx, withdrawTimestamp, ctx.treasurer.publicKey);
      
      // Withdraw the exact same amount
      await ctx.program.methods
        .withdrawToken(exactAmount, withdrawTimestamp)
        .accounts({
          authority: ctx.treasurer.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.treasurerUserPDA,
          tokenBalance: tokenCtx.tokenBalancePDA,
          treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
          recipientTokenAccount: tokenCtx.recipientTokenAccount,
          tokenMint: tokenCtx.tokenMint,
          recipient: ctx.recipient.publicKey,
          auditLog: withdrawAuditLogPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([ctx.treasurer])
        .rpc();
      
      // Verify token balance is now zero
      const updatedTokenBalance = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      expect(updatedTokenBalance.balance.toString()).to.equal("0");
      
      // Verify treasury token account is empty
      const treasuryTokenAccountInfo = await getAccount(
        ctx.provider.connection,
        tokenCtx.treasuryTokenAccount
      );
      expect(Number(treasuryTokenAccountInfo.amount)).to.equal(0);
    });
  });

  describe("Multiple Token Types", () => {
    it("should handle deposits of different token types", async () => {
      // Create timestamps for deposits
      const firstDepositTimestamp = createTimestamp(-10);
      const secondDepositTimestamp = createTimestamp(-5);
      
      // Find audit log PDAs
      const firstAuditLogPDA = await findAuditLogPDA(ctx, firstDepositTimestamp, ctx.depositor.publicKey);
      const secondAuditLogPDA = await findAuditLogPDA(ctx, secondDepositTimestamp, ctx.depositor.publicKey);
      
      // Deposit first token type (100,000 with 6 decimals = 0.1 tokens)
      const firstAmount = new BN(100000);
      
      await ctx.program.methods
        .depositToken(firstAmount, firstDepositTimestamp)
        .accounts({
          treasury: ctx.treasuryPDA,
          tokenBalance: tokenCtx.tokenBalancePDA,
          treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
          depositorTokenAccount: tokenCtx.depositorTokenAccount,
          tokenMint: tokenCtx.tokenMint,
          auditLog: firstAuditLogPDA,
          depositor: ctx.depositor.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([ctx.depositor])
        .rpc();
      
      // Deposit second token type (100,000,000 with 9 decimals = 0.1 tokens)
      const secondAmount = new BN(100000000);
      
      await ctx.program.methods
        .depositToken(secondAmount, secondDepositTimestamp)
        .accounts({
          treasury: ctx.treasuryPDA,
          tokenBalance: secondTokenCtx.tokenBalancePDA,
          treasuryTokenAccount: secondTokenCtx.treasuryTokenAccount,
          depositorTokenAccount: secondTokenCtx.depositorTokenAccount,
          tokenMint: secondTokenCtx.tokenMint,
          auditLog: secondAuditLogPDA,
          depositor: ctx.depositor.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([ctx.depositor])
        .rpc();
      
      // Verify both token balances
      const firstTokenBalance = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      const secondTokenBalance = await ctx.program.account.tokenBalance.fetch(secondTokenCtx.tokenBalancePDA);
      
      expect(firstTokenBalance.balance.toString()).to.equal(firstAmount.toString());
      expect(secondTokenBalance.balance.toString()).to.equal(secondAmount.toString());
      
      // Verify treasury accounts
      const firstTreasuryTokenAccount = await getAccount(
        ctx.provider.connection,
        tokenCtx.treasuryTokenAccount
      );
      const secondTreasuryTokenAccount = await getAccount(
        ctx.provider.connection,
        secondTokenCtx.treasuryTokenAccount
      );
      
      expect(Number(firstTreasuryTokenAccount.amount)).to.equal(firstAmount.toNumber());
      expect(Number(secondTreasuryTokenAccount.amount)).to.equal(secondAmount.toNumber());
    });

    it("should handle withdrawals of different token types", async () => {
      // Create timestamps for withdrawals
      const firstWithdrawTimestamp = createTimestamp(-10);
      const secondWithdrawTimestamp = createTimestamp(-5);
      
      // Find audit log PDAs
      const firstAuditLogPDA = await findAuditLogPDA(ctx, firstWithdrawTimestamp, ctx.treasurer.publicKey);
      const secondAuditLogPDA = await findAuditLogPDA(ctx, secondWithdrawTimestamp, ctx.treasurer.publicKey);
      
      // Withdraw half of first token type (50,000 with 6 decimals = 0.05 tokens)
      const firstWithdrawAmount = new BN(50000);
      
      await ctx.program.methods
        .withdrawToken(firstWithdrawAmount, firstWithdrawTimestamp)
        .accounts({
          authority: ctx.treasurer.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.treasurerUserPDA,
          tokenBalance: tokenCtx.tokenBalancePDA,
          treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
          recipientTokenAccount: tokenCtx.recipientTokenAccount,
          tokenMint: tokenCtx.tokenMint,
          recipient: ctx.recipient.publicKey,
          auditLog: firstAuditLogPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([ctx.treasurer])
        .rpc();
      
      // Withdraw half of second token type (50,000,000 with 9 decimals = 0.05 tokens)
      const secondWithdrawAmount = new BN(50000000);
      
      await ctx.program.methods
        .withdrawToken(secondWithdrawAmount, secondWithdrawTimestamp)
        .accounts({
          authority: ctx.treasurer.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.treasurerUserPDA,
          tokenBalance: secondTokenCtx.tokenBalancePDA,
          treasuryTokenAccount: secondTokenCtx.treasuryTokenAccount,
          recipientTokenAccount: secondTokenCtx.recipientTokenAccount,
          tokenMint: secondTokenCtx.tokenMint,
          recipient: ctx.recipient.publicKey,
          auditLog: secondAuditLogPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([ctx.treasurer])
        .rpc();
      
      // Verify both token balances were updated correctly
      const firstTokenBalance = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      const secondTokenBalance = await ctx.program.account.tokenBalance.fetch(secondTokenCtx.tokenBalancePDA);
      
      expect(firstTokenBalance.balance.toString()).to.equal("50000"); // 0.05 tokens remaining
      expect(secondTokenBalance.balance.toString()).to.equal("50000000"); // 0.05 tokens remaining
      
      // Verify recipient received both token types
      const firstRecipientTokenAccount = await getAccount(
        ctx.provider.connection,
        tokenCtx.recipientTokenAccount
      );
      const secondRecipientTokenAccount = await getAccount(
        ctx.provider.connection,
        secondTokenCtx.recipientTokenAccount
      );
      
      expect(Number(firstRecipientTokenAccount.amount)).to.equal(firstWithdrawAmount.toNumber());
      expect(Number(secondRecipientTokenAccount.amount)).to.equal(secondWithdrawAmount.toNumber());
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple deposits in quick succession", async () => {
      // Create multiple deposits with slightly different timestamps
      const depositAmount = new BN(10000); // 0.01 tokens with 6 decimals
      const initialBalance = (await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA)).balance;
      
      // Perform 5 deposits in quick succession
      const depositPromises = [];
      
      for (let i = 0; i < 5; i++) {
        const depositTimestamp = createTimestamp(-20 - i); // Different timestamps
        const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
        
        depositPromises.push(
          ctx.program.methods
            .depositToken(depositAmount, depositTimestamp)
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
            .rpc()
        );
      }
      
      // Wait for all deposits to complete
      await Promise.all(depositPromises);
      
      // Verify final balance
      const finalTokenBalance = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      const expectedBalance = initialBalance.add(depositAmount.mul(new BN(5)));
      expect(finalTokenBalance.balance.toString()).to.equal(expectedBalance.toString());
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle minimum token amount", async () => {
      // Create a timestamp for the deposit
      const depositTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
      
      // Deposit minimum amount (1 with 6 decimals = 0.000001 tokens)
      const minAmount = new BN(1);
      
      await ctx.program.methods
        .depositToken(minAmount, depositTimestamp)
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
      
      // Verify token balance was updated
      const tokenBalanceAccount = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      const previousBalance = tokenBalanceAccount.balance.sub(minAmount);
      
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = createTimestamp();
      
      // Find audit log PDA for withdrawal
      const withdrawAuditLogPDA = await findAuditLogPDA(ctx, withdrawTimestamp, ctx.treasurer.publicKey);
      
      // Withdraw the minimum amount
      await ctx.program.methods
        .withdrawToken(minAmount, withdrawTimestamp)
        .accounts({
          authority: ctx.treasurer.publicKey,
          treasury: ctx.treasuryPDA,
          user: ctx.treasurerUserPDA,
          tokenBalance: tokenCtx.tokenBalancePDA,
          treasuryTokenAccount: tokenCtx.treasuryTokenAccount,
          recipientTokenAccount: tokenCtx.recipientTokenAccount,
          tokenMint: tokenCtx.tokenMint,
          recipient: ctx.recipient.publicKey,
          auditLog: withdrawAuditLogPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([ctx.treasurer])
        .rpc();
      
      // Verify token balance is back to previous amount
      const updatedTokenBalance = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      expect(updatedTokenBalance.balance.toString()).to.equal(previousBalance.toString());
    });
  });
});