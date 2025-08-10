import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TreasuryVault } from "../target/types/treasury_vault";
import { BN } from "bn.js";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";

// Constants for testing
export const EPOCH_DURATION = new BN(86400); // 1 day in seconds
export const SPENDING_LIMIT = new BN(1000000000); // 1 SOL in lamports (also used for token amount)
export const DEPOSIT_AMOUNT = new BN(500000); // 0.5 tokens (with 6 decimals)
export const WITHDRAW_AMOUNT = new BN(200000); // 0.2 tokens (with 6 decimals)
export const PAYOUT_AMOUNT = new BN(100000); // 0.1 tokens (with 6 decimals)

// User roles
export const ADMIN_ROLE = 0;
export const TREASURER_ROLE = 1;
export const USER_ROLE = 2;

// Audit log actions
export const AUDIT_ACTION_WITHDRAW = 1;
export const AUDIT_ACTION_DEPOSIT = 2;
export const AUDIT_ACTION_TOKEN_DEPOSIT = 12;
export const AUDIT_ACTION_TOKEN_PAYOUT = 13;

export interface TestContext {
  provider: anchor.AnchorProvider;
  program: Program<TreasuryVault>;
  admin: anchor.web3.Keypair;
  treasurer: anchor.web3.Keypair;
  depositor: anchor.web3.Keypair;
  recipient: anchor.web3.Keypair;
  treasuryPDA: anchor.web3.PublicKey;
  treasuryBump: number;
  adminUserPDA: anchor.web3.PublicKey;
  treasurerUserPDA: anchor.web3.PublicKey;
  recipientPDA: anchor.web3.PublicKey;
}

export interface TokenContext {
  tokenMint: anchor.web3.PublicKey;
  treasuryTokenAccount: anchor.web3.PublicKey;
  depositorTokenAccount: anchor.web3.PublicKey;
  recipientTokenAccount: anchor.web3.PublicKey;
  tokenBalancePDA: anchor.web3.PublicKey;
}

export interface PayoutContext {
  payoutSchedulePDA: anchor.web3.PublicKey;
  recurringPayoutPDA: anchor.web3.PublicKey;
}

export async function setupTestContext(): Promise<TestContext> {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TreasuryVault as Program<TreasuryVault>;
  const admin = anchor.web3.Keypair.generate();
  const treasurer = anchor.web3.Keypair.generate();
  const depositor = anchor.web3.Keypair.generate();
  const recipient = anchor.web3.Keypair.generate();
  
  // Airdrop SOL to all accounts for testing
  await provider.connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
  await provider.connection.requestAirdrop(treasurer.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
  await provider.connection.requestAirdrop(depositor.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
  await provider.connection.requestAirdrop(recipient.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
  
  // Wait for confirmation
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  // Find PDAs
  const [treasuryPDA, treasuryBump] = await anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    program.programId
  );
  
  // Find user PDAs
  const [adminUserPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("user"),
      admin.publicKey.toBuffer(),
      treasuryPDA.toBuffer(),
    ],
    program.programId
  );
  
  const [treasurerUserPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("user"),
      treasurer.publicKey.toBuffer(),
      treasuryPDA.toBuffer(),
    ],
    program.programId
  );
  
  // Find recipient PDA
  const [recipientPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("recipient"),
      recipient.publicKey.toBuffer(),
      treasuryPDA.toBuffer(),
    ],
    program.programId
  );

  return {
    provider,
    program,
    admin,
    treasurer,
    depositor,
    recipient,
    treasuryPDA,
    treasuryBump,
    adminUserPDA,
    treasurerUserPDA,
    recipientPDA
  };
}

export async function initializeTreasury(ctx: TestContext): Promise<void> {
  // Initialize treasury
  await ctx.program.methods
    .initializeTreasury(EPOCH_DURATION, SPENDING_LIMIT)
    .accounts({
      treasury: ctx.treasuryPDA,
      admin: ctx.admin.publicKey,
      admin_user: ctx.adminUserPDA,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([ctx.admin])
    .rpc();
  
  // Add treasurer
  await ctx.program.methods
    .addTreasuryUser(TREASURER_ROLE)
    .accounts({
      admin: ctx.admin.publicKey,
      treasury: ctx.treasuryPDA,
      userAccount: ctx.treasurerUserPDA,
      user: ctx.treasurer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([ctx.admin])
    .rpc();
  
  // Add recipient
  await ctx.program.methods
    .addWhitelistedRecipient("Test Recipient")
    .accounts({
      authority: ctx.admin.publicKey,
      treasury: ctx.treasuryPDA,
      user: ctx.adminUserPDA,
      recipientAccount: ctx.recipientPDA,
      recipient: ctx.recipient.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([ctx.admin])
    .rpc();
}

export async function setupTokenContext(ctx: TestContext, decimals: number = 6): Promise<TokenContext> {
  // Create token mint with specified decimals
  const tokenMint = await createMint(
    ctx.provider.connection,
    ctx.admin,
    ctx.admin.publicKey,
    null,
    decimals
  );
  
  // Create token accounts
  const depositorTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
    ctx.provider.connection,
    ctx.admin, // payer
    tokenMint,
    ctx.depositor.publicKey
  );
  const depositorTokenAccount = depositorTokenAccountInfo.address;
  
  const recipientTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
    ctx.provider.connection,
    ctx.admin, // payer
    tokenMint,
    ctx.recipient.publicKey
  );
  const recipientTokenAccount = recipientTokenAccountInfo.address;
  
  // Mint tokens to depositor (1 token with specified decimals)
  await mintTo(
    ctx.provider.connection,
    ctx.admin,
    tokenMint,
    depositorTokenAccount,
    ctx.admin.publicKey,
    10 ** decimals
  );
  
  // Create treasury token account
  const treasuryTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
    ctx.provider.connection,
    ctx.admin, // payer
    tokenMint,
    ctx.treasuryPDA, // owner
    true // allow owner to be a PDA
  );
  const treasuryTokenAccount = treasuryTokenAccountInfo.address;
  
  // Find token balance PDA
  const [tokenBalancePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("token_balance"),
      ctx.treasuryPDA.toBuffer(),
      tokenMint.toBuffer(),
    ],
    ctx.program.programId
  );
  
  return {
    tokenMint,
    treasuryTokenAccount,
    depositorTokenAccount,
    recipientTokenAccount,
    tokenBalancePDA
  };
}

export async function setupPayoutContext(ctx: TestContext, tokenMint: anchor.web3.PublicKey): Promise<PayoutContext> {
  // Find payout schedule PDA for one-time payout
  const [payoutSchedulePDA] = await anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("payout"),
      ctx.recipient.publicKey.toBuffer(),
      ctx.treasuryPDA.toBuffer(),
      new BN(1).toArrayLike(Buffer, "le", 8), // Index 1
    ],
    ctx.program.programId
  );
  
  // Find payout schedule PDA for recurring payout
  const [recurringPayoutPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("payout"),
      ctx.recipient.publicKey.toBuffer(),
      ctx.treasuryPDA.toBuffer(),
      new BN(2).toArrayLike(Buffer, "le", 8), // Index 2
    ],
    ctx.program.programId
  );
  
  return {
    payoutSchedulePDA,
    recurringPayoutPDA
  };
}

export async function findAuditLogPDA(
  ctx: TestContext, 
  timestamp: BN, 
  authority: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> {
  const [auditLogPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("audit"),
      ctx.treasuryPDA.toBuffer(),
      timestamp.toArrayLike(Buffer, "le", 8),
      authority.toBuffer(),
    ],
    ctx.program.programId
  );
  
  return auditLogPDA;
}

export function createTimestamp(offsetSeconds: number = -5): BN {
  return new BN(Math.floor(Date.now() / 1000) + offsetSeconds);
}