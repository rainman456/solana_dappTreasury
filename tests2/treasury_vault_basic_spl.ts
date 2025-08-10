import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { BN } from "bn.js";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  TestContext,
  TokenContext,
  setupTestContext,
  initializeTreasury,
  setupTokenContext,
  createTimestamp,
  findAuditLogPDA,
  DEPOSIT_AMOUNT,
  WITHDRAW_AMOUNT,
  AUDIT_ACTION_TOKEN_DEPOSIT
} from "./test_utils";

describe("treasury_vault_basic_spl", () => {
  let ctx: TestContext;
  let tokenCtx: TokenContext;

  before(async () => {
    // Setup test context
    ctx = await setupTestContext();
    await initializeTreasury(ctx);
    
    // Setup token context
    tokenCtx = await setupTokenContext(ctx);
  });

  describe("Basic SPL Token Operations", () => {
    it("should allow depositing tokens to treasury", async () => {
      // Create a timestamp for the deposit
      const depositTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
      
      // Get initial balances
      const initialDepositorTokenAccount = await getAccount(
        ctx.provider.connection,
        tokenCtx.depositorTokenAccount
      );
      const initialDepositorBalance = Number(initialDepositorTokenAccount.amount);
      
      // Deposit tokens
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
      
      // Verify token balance account was created
      const tokenBalanceAccount = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      expect(tokenBalanceAccount.treasury.toString()).to.equal(ctx.treasuryPDA.toString());
      expect(tokenBalanceAccount.tokenMint.toString()).to.equal(tokenCtx.tokenMint.toString());
      expect(tokenBalanceAccount.balance.toString()).to.equal(DEPOSIT_AMOUNT.toString());
      
      // Verify tokens were transferred
      const finalDepositorTokenAccount = await getAccount(
        ctx.provider.connection,
        tokenCtx.depositorTokenAccount
      );
      const finalDepositorBalance = Number(finalDepositorTokenAccount.amount);
      expect(initialDepositorBalance - finalDepositorBalance).to.equal(DEPOSIT_AMOUNT.toNumber());
      
      const treasuryTokenAccountInfo = await getAccount(
        ctx.provider.connection,
        tokenCtx.treasuryTokenAccount
      );
      expect(Number(treasuryTokenAccountInfo.amount)).to.equal(DEPOSIT_AMOUNT.toNumber());
      
      // Verify audit log
      const auditLogAccount = await ctx.program.account.auditLog.fetch(auditLogPDA);
      expect(auditLogAccount.action).to.equal(AUDIT_ACTION_TOKEN_DEPOSIT);
      expect(auditLogAccount.amount.toString()).to.equal(DEPOSIT_AMOUNT.toString());
      expect(auditLogAccount.tokenMint).to.not.be.null;
      expect(auditLogAccount.tokenMint?.toString()).to.equal(tokenCtx.tokenMint.toString());
    });

    it("should handle multiple deposits correctly", async () => {
      // Create a timestamp for the deposit
      const depositTimestamp = createTimestamp(-15);
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, depositTimestamp, ctx.depositor.publicKey);
      
      // Get initial token balance
      const initialTokenBalance = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      
      // Make another deposit
      const secondDepositAmount = new BN(300000); // 0.3 tokens with 6 decimals
      
      await ctx.program.methods
        .depositToken(secondDepositAmount, depositTimestamp)
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
      
      // Verify token balance was updated correctly
      const updatedTokenBalance = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      const expectedBalance = initialTokenBalance.balance.add(secondDepositAmount);
      expect(updatedTokenBalance.balance.toString()).to.equal(expectedBalance.toString());
      
      // Verify tokens were transferred
      const treasuryTokenAccountInfo = await getAccount(
        ctx.provider.connection,
        tokenCtx.treasuryTokenAccount
      );
      expect(Number(treasuryTokenAccountInfo.amount)).to.equal(expectedBalance.toNumber());
    });

    it("should allow treasurer to withdraw tokens", async () => {
      // Create a timestamp for the withdrawal
      const withdrawTimestamp = createTimestamp();
      
      // Find audit log PDA
      const auditLogPDA = await findAuditLogPDA(ctx, withdrawTimestamp, ctx.treasurer.publicKey);
      
      // Get initial balances
      const initialTokenBalance = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      const initialRecipientTokenAccount = await getAccount(
        ctx.provider.connection,
        tokenCtx.recipientTokenAccount
      );
      const initialRecipientBalance = Number(initialRecipientTokenAccount.amount);
      
      // Withdraw tokens
      await ctx.program.methods
        .withdrawToken(WITHDRAW_AMOUNT, withdrawTimestamp)
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
      
      // Verify token balance was updated
      const updatedTokenBalance = await ctx.program.account.tokenBalance.fetch(tokenCtx.tokenBalancePDA);
      const expectedBalance = initialTokenBalance.balance.sub(WITHDRAW_AMOUNT);
      expect(updatedTokenBalance.balance.toString()).to.equal(expectedBalance.toString());
      
      // Verify tokens were transferred
      const finalRecipientTokenAccount = await getAccount(
        ctx.provider.connection,
        tokenCtx.recipientTokenAccount
      );
      const finalRecipientBalance = Number(finalRecipientTokenAccount.amount);
      expect(finalRecipientBalance - initialRecipientBalance).to.equal(WITHDRAW_AMOUNT.toNumber());
    });
  });
});