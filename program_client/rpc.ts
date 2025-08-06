import {
  AnchorProvider,
  BN,
  IdlAccounts,
  Program,
  web3,
} from "@coral-xyz/anchor";
import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import { TreasuryVault } from "../../target/types/treasury_vault";
import idl from "../../target/idl/treasury_vault.json";
import * as pda from "./pda";

import { CslSplToken } from "../../target/types/csl_spl_token";
import idlCslSplToken from "../../target/idl/csl_spl_token.json";



let _program: Program<TreasuryVault>;
let _programCslSplToken: Program<CslSplToken>;


export const initializeClient = (
    programId: web3.PublicKey,
    anchorProvider = AnchorProvider.env(),
) => {
    _program = new Program<TreasuryVault>(
        idl as never,
        programId,
        anchorProvider,
    );

    _programCslSplToken = new Program<CslSplToken>(
        idlCslSplToken as never,
        new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        anchorProvider,
    );

};

export type InitializeTreasuryArgs = {
  admin: web3.PublicKey;
  mint: web3.PublicKey | undefined;
  epochDuration: bigint;
  spendingLimit: bigint;
  tokenGatedMint: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[signer]` admin: {@link PublicKey} 
 * 1. `[writable]` treasury: {@link Treasury} 
 * 2. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - mint: {@link PublicKey | undefined} The token mint (null for SOL)
 * - epoch_duration: {@link BigInt} Duration of each epoch in seconds
 * - spending_limit: {@link BigInt} Maximum amount that can be spent in an epoch
 * - token_gated_mint: {@link PublicKey | undefined} Optional token mint for token-gated access
 */
export const initializeTreasuryBuilder = (
	args: InitializeTreasuryArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);

  return _program
    .methods
    .initializeTreasury(
      args.mint,
      new BN(args.epochDuration.toString()),
      new BN(args.spendingLimit.toString()),
      args.tokenGatedMint,
    )
    .accountsStrict({
      admin: args.admin,
      treasury: treasuryPubkey,
      systemProgram: new web3.PublicKey("11111111111111111111111111111111"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[signer]` admin: {@link PublicKey} 
 * 1. `[writable]` treasury: {@link Treasury} 
 * 2. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - mint: {@link PublicKey | undefined} The token mint (null for SOL)
 * - epoch_duration: {@link BigInt} Duration of each epoch in seconds
 * - spending_limit: {@link BigInt} Maximum amount that can be spent in an epoch
 * - token_gated_mint: {@link PublicKey | undefined} Optional token mint for token-gated access
 */
export const initializeTreasury = (
	args: InitializeTreasuryArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    initializeTreasuryBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[signer]` admin: {@link PublicKey} 
 * 1. `[writable]` treasury: {@link Treasury} 
 * 2. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - mint: {@link PublicKey | undefined} The token mint (null for SOL)
 * - epoch_duration: {@link BigInt} Duration of each epoch in seconds
 * - spending_limit: {@link BigInt} Maximum amount that can be spent in an epoch
 * - token_gated_mint: {@link PublicKey | undefined} Optional token mint for token-gated access
 */
export const initializeTreasurySendAndConfirm = async (
  args: Omit<InitializeTreasuryArgs, "admin"> & {
    signers: {
      admin: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return initializeTreasuryBuilder({
      ...args,
      admin: args.signers.admin.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.admin])
    .rpc();
}

export type DepositArgs = {
  depositor: web3.PublicKey;
  source: web3.PublicKey;
  destination: web3.PublicKey;
  authority: web3.PublicKey;
  mint: web3.PublicKey | undefined;
  amount: bigint;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[signer]` depositor: {@link PublicKey} 
 * 1. `[]` treasury: {@link Treasury} 
 * 2. `[writable]` source: {@link PublicKey} The source account.
 * 3. `[writable]` destination: {@link PublicKey} The destination account.
 * 4. `[signer]` authority: {@link PublicKey} The source account's owner/delegate.
 * 5. `[]` csl_spl_token_v0_0_0: {@link PublicKey} Auto-generated, CslSplTokenProgram v0.0.0
 *
 * Data:
 * - mint: {@link PublicKey | undefined} 
 * - amount: {@link BigInt} The amount to deposit
 */
export const depositBuilder = (
	args: DepositArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);

  return _program
    .methods
    .deposit(
      args.mint,
      new BN(args.amount.toString()),
    )
    .accountsStrict({
      depositor: args.depositor,
      treasury: treasuryPubkey,
      source: args.source,
      destination: args.destination,
      authority: args.authority,
      cslSplTokenV000: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[signer]` depositor: {@link PublicKey} 
 * 1. `[]` treasury: {@link Treasury} 
 * 2. `[writable]` source: {@link PublicKey} The source account.
 * 3. `[writable]` destination: {@link PublicKey} The destination account.
 * 4. `[signer]` authority: {@link PublicKey} The source account's owner/delegate.
 * 5. `[]` csl_spl_token_v0_0_0: {@link PublicKey} Auto-generated, CslSplTokenProgram v0.0.0
 *
 * Data:
 * - mint: {@link PublicKey | undefined} 
 * - amount: {@link BigInt} The amount to deposit
 */
export const deposit = (
	args: DepositArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    depositBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[signer]` depositor: {@link PublicKey} 
 * 1. `[]` treasury: {@link Treasury} 
 * 2. `[writable]` source: {@link PublicKey} The source account.
 * 3. `[writable]` destination: {@link PublicKey} The destination account.
 * 4. `[signer]` authority: {@link PublicKey} The source account's owner/delegate.
 * 5. `[]` csl_spl_token_v0_0_0: {@link PublicKey} Auto-generated, CslSplTokenProgram v0.0.0
 *
 * Data:
 * - mint: {@link PublicKey | undefined} 
 * - amount: {@link BigInt} The amount to deposit
 */
export const depositSendAndConfirm = async (
  args: Omit<DepositArgs, "depositor" | "authority"> & {
    signers: {
      depositor: web3.Signer,
      authority: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return depositBuilder({
      ...args,
      depositor: args.signers.depositor.publicKey,
      authority: args.signers.authority.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.depositor, args.signers.authority])
    .rpc();
}

export type SchedulePayoutArgs = {
  authority: web3.PublicKey;
  recipient: web3.PublicKey;
  mint: web3.PublicKey | undefined;
  amount: bigint;
  scheduledTime: bigint;
  recurring: boolean;
  recurrenceInterval: bigint | undefined;
  recurrenceEndTime: bigint | undefined;
  id: bigint;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[writable]` payout: {@link Payout} 
 * 2. `[signer]` authority: {@link PublicKey} Must be admin or treasurer
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - recipient: {@link PublicKey} The recipient of the payout
 * - mint: {@link PublicKey | undefined} 
 * - amount: {@link BigInt} The amount to be paid out
 * - scheduled_time: {@link BigInt} The time when the payout is scheduled
 * - recurring: {@link boolean} Whether this is a recurring payout
 * - recurrence_interval: {@link BigInt | undefined} Interval for recurring payouts in seconds
 * - recurrence_end_time: {@link BigInt | undefined} End time for recurring payouts
 * - id: {@link BigInt} Unique identifier for this payout
 */
export const schedulePayoutBuilder = (
	args: SchedulePayoutArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);
    const [payoutPubkey] = pda.derivePayoutPDA({
        treasury: args.treasury,
        recipient: args.recipient,
        id: args.id,
    }, _program.programId);

  return _program
    .methods
    .schedulePayout(
      args.recipient,
      args.mint,
      new BN(args.amount.toString()),
      new BN(args.scheduledTime.toString()),
      args.recurring,
      args.recurrenceInterval ? new BN(args.recurrenceInterval.toString()) : undefined,
      args.recurrenceEndTime ? new BN(args.recurrenceEndTime.toString()) : undefined,
      new BN(args.id.toString()),
    )
    .accountsStrict({
      treasury: treasuryPubkey,
      payout: payoutPubkey,
      authority: args.authority,
      systemProgram: new web3.PublicKey("11111111111111111111111111111111"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[writable]` payout: {@link Payout} 
 * 2. `[signer]` authority: {@link PublicKey} Must be admin or treasurer
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - recipient: {@link PublicKey} The recipient of the payout
 * - mint: {@link PublicKey | undefined} 
 * - amount: {@link BigInt} The amount to be paid out
 * - scheduled_time: {@link BigInt} The time when the payout is scheduled
 * - recurring: {@link boolean} Whether this is a recurring payout
 * - recurrence_interval: {@link BigInt | undefined} Interval for recurring payouts in seconds
 * - recurrence_end_time: {@link BigInt | undefined} End time for recurring payouts
 * - id: {@link BigInt} Unique identifier for this payout
 */
export const schedulePayout = (
	args: SchedulePayoutArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    schedulePayoutBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[writable]` payout: {@link Payout} 
 * 2. `[signer]` authority: {@link PublicKey} Must be admin or treasurer
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - recipient: {@link PublicKey} The recipient of the payout
 * - mint: {@link PublicKey | undefined} 
 * - amount: {@link BigInt} The amount to be paid out
 * - scheduled_time: {@link BigInt} The time when the payout is scheduled
 * - recurring: {@link boolean} Whether this is a recurring payout
 * - recurrence_interval: {@link BigInt | undefined} Interval for recurring payouts in seconds
 * - recurrence_end_time: {@link BigInt | undefined} End time for recurring payouts
 * - id: {@link BigInt} Unique identifier for this payout
 */
export const schedulePayoutSendAndConfirm = async (
  args: Omit<SchedulePayoutArgs, "authority"> & {
    signers: {
      authority: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return schedulePayoutBuilder({
      ...args,
      authority: args.signers.authority.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.authority])
    .rpc();
}

export type ExecutePayoutArgs = {
  authority: web3.PublicKey;
  recipient: web3.PublicKey;
  source: web3.PublicKey;
  destination: web3.PublicKey;
  mint: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[writable]` payout: {@link Payout} 
 * 2. `[signer]` authority: {@link PublicKey} Must be admin or treasurer
 * 3. `[writable]` recipient: {@link PublicKey} 
 * 4. `[]` whitelist: {@link WhitelistedRecipient} Verify recipient is whitelisted
 * 5. `[writable]` source: {@link PublicKey} The source account.
 * 6. `[writable]` destination: {@link PublicKey} The destination account.
 * 7. `[]` csl_spl_token_v0_0_0: {@link PublicKey} Auto-generated, CslSplTokenProgram v0.0.0
 *
 * Data:
 * - mint: {@link PublicKey | undefined} 
 */
export const executePayoutBuilder = (
	args: ExecutePayoutArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);
    const [payoutPubkey] = pda.derivePayoutPDA({
        treasury: args.treasury,
        recipient: args.recipient,
        id: args.id,
    }, _program.programId);
    const [whitelistPubkey] = pda.deriveWhitelistPDA({
        treasury: args.treasury,
        recipient: args.recipient,
    }, _program.programId);

  return _program
    .methods
    .executePayout(
      args.mint,
    )
    .accountsStrict({
      treasury: treasuryPubkey,
      payout: payoutPubkey,
      authority: args.authority,
      recipient: args.recipient,
      whitelist: whitelistPubkey,
      source: args.source,
      destination: args.destination,
      cslSplTokenV000: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[writable]` payout: {@link Payout} 
 * 2. `[signer]` authority: {@link PublicKey} Must be admin or treasurer
 * 3. `[writable]` recipient: {@link PublicKey} 
 * 4. `[]` whitelist: {@link WhitelistedRecipient} Verify recipient is whitelisted
 * 5. `[writable]` source: {@link PublicKey} The source account.
 * 6. `[writable]` destination: {@link PublicKey} The destination account.
 * 7. `[]` csl_spl_token_v0_0_0: {@link PublicKey} Auto-generated, CslSplTokenProgram v0.0.0
 *
 * Data:
 * - mint: {@link PublicKey | undefined} 
 */
export const executePayout = (
	args: ExecutePayoutArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    executePayoutBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[writable]` payout: {@link Payout} 
 * 2. `[signer]` authority: {@link PublicKey} Must be admin or treasurer
 * 3. `[writable]` recipient: {@link PublicKey} 
 * 4. `[]` whitelist: {@link WhitelistedRecipient} Verify recipient is whitelisted
 * 5. `[writable]` source: {@link PublicKey} The source account.
 * 6. `[writable]` destination: {@link PublicKey} The destination account.
 * 7. `[]` csl_spl_token_v0_0_0: {@link PublicKey} Auto-generated, CslSplTokenProgram v0.0.0
 *
 * Data:
 * - mint: {@link PublicKey | undefined} 
 */
export const executePayoutSendAndConfirm = async (
  args: Omit<ExecutePayoutArgs, "authority"> & {
    signers: {
      authority: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return executePayoutBuilder({
      ...args,
      authority: args.signers.authority.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.authority])
    .rpc();
}

export type UpdateAdminArgs = {
  admin: web3.PublicKey;
  newAdmin: web3.PublicKey;
  mint: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} Current admin
 *
 * Data:
 * - new_admin: {@link PublicKey} New admin address
 * - mint: {@link PublicKey | undefined} 
 */
export const updateAdminBuilder = (
	args: UpdateAdminArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);

  return _program
    .methods
    .updateAdmin(
      args.newAdmin,
      args.mint,
    )
    .accountsStrict({
      treasury: treasuryPubkey,
      admin: args.admin,
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} Current admin
 *
 * Data:
 * - new_admin: {@link PublicKey} New admin address
 * - mint: {@link PublicKey | undefined} 
 */
export const updateAdmin = (
	args: UpdateAdminArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    updateAdminBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} Current admin
 *
 * Data:
 * - new_admin: {@link PublicKey} New admin address
 * - mint: {@link PublicKey | undefined} 
 */
export const updateAdminSendAndConfirm = async (
  args: Omit<UpdateAdminArgs, "admin"> & {
    signers: {
      admin: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return updateAdminBuilder({
      ...args,
      admin: args.signers.admin.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.admin])
    .rpc();
}

export type AddTreasurerArgs = {
  admin: web3.PublicKey;
  user: web3.PublicKey;
  mint: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` user_role: {@link UserRole} 
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - user: {@link PublicKey} User to be given treasurer role
 * - mint: {@link PublicKey | undefined} 
 */
export const addTreasurerBuilder = (
	args: AddTreasurerArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);
    const [userRolePubkey] = pda.deriveUserRolePDA({
        treasury: args.treasury,
        user: args.user,
    }, _program.programId);

  return _program
    .methods
    .addTreasurer(
      args.user,
      args.mint,
    )
    .accountsStrict({
      treasury: treasuryPubkey,
      admin: args.admin,
      userRole: userRolePubkey,
      systemProgram: new web3.PublicKey("11111111111111111111111111111111"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` user_role: {@link UserRole} 
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - user: {@link PublicKey} User to be given treasurer role
 * - mint: {@link PublicKey | undefined} 
 */
export const addTreasurer = (
	args: AddTreasurerArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    addTreasurerBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` user_role: {@link UserRole} 
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - user: {@link PublicKey} User to be given treasurer role
 * - mint: {@link PublicKey | undefined} 
 */
export const addTreasurerSendAndConfirm = async (
  args: Omit<AddTreasurerArgs, "admin"> & {
    signers: {
      admin: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return addTreasurerBuilder({
      ...args,
      admin: args.signers.admin.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.admin])
    .rpc();
}

export type RemoveTreasurerArgs = {
  admin: web3.PublicKey;
  user: web3.PublicKey;
  mint: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` user_role: {@link UserRole} 
 *
 * Data:
 * - user: {@link PublicKey} User to remove treasurer role from
 * - mint: {@link PublicKey | undefined} 
 */
export const removeTreasurerBuilder = (
	args: RemoveTreasurerArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);
    const [userRolePubkey] = pda.deriveUserRolePDA({
        treasury: args.treasury,
        user: args.user,
    }, _program.programId);

  return _program
    .methods
    .removeTreasurer(
      args.user,
      args.mint,
    )
    .accountsStrict({
      treasury: treasuryPubkey,
      admin: args.admin,
      userRole: userRolePubkey,
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` user_role: {@link UserRole} 
 *
 * Data:
 * - user: {@link PublicKey} User to remove treasurer role from
 * - mint: {@link PublicKey | undefined} 
 */
export const removeTreasurer = (
	args: RemoveTreasurerArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    removeTreasurerBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` user_role: {@link UserRole} 
 *
 * Data:
 * - user: {@link PublicKey} User to remove treasurer role from
 * - mint: {@link PublicKey | undefined} 
 */
export const removeTreasurerSendAndConfirm = async (
  args: Omit<RemoveTreasurerArgs, "admin"> & {
    signers: {
      admin: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return removeTreasurerBuilder({
      ...args,
      admin: args.signers.admin.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.admin])
    .rpc();
}

export type AddWhitelistArgs = {
  admin: web3.PublicKey;
  recipient: web3.PublicKey;
  mint: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` whitelist: {@link WhitelistedRecipient} 
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - recipient: {@link PublicKey} Recipient to be whitelisted
 * - mint: {@link PublicKey | undefined} 
 */
export const addWhitelistBuilder = (
	args: AddWhitelistArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);
    const [whitelistPubkey] = pda.deriveWhitelistPDA({
        treasury: args.treasury,
        recipient: args.recipient,
    }, _program.programId);

  return _program
    .methods
    .addWhitelist(
      args.recipient,
      args.mint,
    )
    .accountsStrict({
      treasury: treasuryPubkey,
      admin: args.admin,
      whitelist: whitelistPubkey,
      systemProgram: new web3.PublicKey("11111111111111111111111111111111"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` whitelist: {@link WhitelistedRecipient} 
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - recipient: {@link PublicKey} Recipient to be whitelisted
 * - mint: {@link PublicKey | undefined} 
 */
export const addWhitelist = (
	args: AddWhitelistArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    addWhitelistBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` whitelist: {@link WhitelistedRecipient} 
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - recipient: {@link PublicKey} Recipient to be whitelisted
 * - mint: {@link PublicKey | undefined} 
 */
export const addWhitelistSendAndConfirm = async (
  args: Omit<AddWhitelistArgs, "admin"> & {
    signers: {
      admin: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return addWhitelistBuilder({
      ...args,
      admin: args.signers.admin.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.admin])
    .rpc();
}

export type RemoveWhitelistArgs = {
  admin: web3.PublicKey;
  recipient: web3.PublicKey;
  mint: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` whitelist: {@link WhitelistedRecipient} 
 *
 * Data:
 * - recipient: {@link PublicKey} Recipient to remove from whitelist
 * - mint: {@link PublicKey | undefined} 
 */
export const removeWhitelistBuilder = (
	args: RemoveWhitelistArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);
    const [whitelistPubkey] = pda.deriveWhitelistPDA({
        treasury: args.treasury,
        recipient: args.recipient,
    }, _program.programId);

  return _program
    .methods
    .removeWhitelist(
      args.recipient,
      args.mint,
    )
    .accountsStrict({
      treasury: treasuryPubkey,
      admin: args.admin,
      whitelist: whitelistPubkey,
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` whitelist: {@link WhitelistedRecipient} 
 *
 * Data:
 * - recipient: {@link PublicKey} Recipient to remove from whitelist
 * - mint: {@link PublicKey | undefined} 
 */
export const removeWhitelist = (
	args: RemoveWhitelistArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    removeWhitelistBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 * 2. `[writable]` whitelist: {@link WhitelistedRecipient} 
 *
 * Data:
 * - recipient: {@link PublicKey} Recipient to remove from whitelist
 * - mint: {@link PublicKey | undefined} 
 */
export const removeWhitelistSendAndConfirm = async (
  args: Omit<RemoveWhitelistArgs, "admin"> & {
    signers: {
      admin: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return removeWhitelistBuilder({
      ...args,
      admin: args.signers.admin.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.admin])
    .rpc();
}

export type UpdateSpendingLimitArgs = {
  admin: web3.PublicKey;
  newSpendingLimit: bigint;
  mint: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 *
 * Data:
 * - new_spending_limit: {@link BigInt} New spending limit per epoch
 * - mint: {@link PublicKey | undefined} 
 */
export const updateSpendingLimitBuilder = (
	args: UpdateSpendingLimitArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);

  return _program
    .methods
    .updateSpendingLimit(
      new BN(args.newSpendingLimit.toString()),
      args.mint,
    )
    .accountsStrict({
      treasury: treasuryPubkey,
      admin: args.admin,
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 *
 * Data:
 * - new_spending_limit: {@link BigInt} New spending limit per epoch
 * - mint: {@link PublicKey | undefined} 
 */
export const updateSpendingLimit = (
	args: UpdateSpendingLimitArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    updateSpendingLimitBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 *
 * Data:
 * - new_spending_limit: {@link BigInt} New spending limit per epoch
 * - mint: {@link PublicKey | undefined} 
 */
export const updateSpendingLimitSendAndConfirm = async (
  args: Omit<UpdateSpendingLimitArgs, "admin"> & {
    signers: {
      admin: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return updateSpendingLimitBuilder({
      ...args,
      admin: args.signers.admin.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.admin])
    .rpc();
}

export type UpdateEpochDurationArgs = {
  admin: web3.PublicKey;
  newEpochDuration: bigint;
  mint: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 *
 * Data:
 * - new_epoch_duration: {@link BigInt} New epoch duration in seconds
 * - mint: {@link PublicKey | undefined} 
 */
export const updateEpochDurationBuilder = (
	args: UpdateEpochDurationArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<TreasuryVault, never> => {
    const [treasuryPubkey] = pda.deriveTreasuryPDA({
        mint: args.mint,
    }, _program.programId);

  return _program
    .methods
    .updateEpochDuration(
      new BN(args.newEpochDuration.toString()),
      args.mint,
    )
    .accountsStrict({
      treasury: treasuryPubkey,
      admin: args.admin,
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 *
 * Data:
 * - new_epoch_duration: {@link BigInt} New epoch duration in seconds
 * - mint: {@link PublicKey | undefined} 
 */
export const updateEpochDuration = (
	args: UpdateEpochDurationArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    updateEpochDurationBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Accounts:
 * 0. `[writable]` treasury: {@link Treasury} 
 * 1. `[signer]` admin: {@link PublicKey} 
 *
 * Data:
 * - new_epoch_duration: {@link BigInt} New epoch duration in seconds
 * - mint: {@link PublicKey | undefined} 
 */
export const updateEpochDurationSendAndConfirm = async (
  args: Omit<UpdateEpochDurationArgs, "admin"> & {
    signers: {
      admin: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return updateEpochDurationBuilder({
      ...args,
      admin: args.signers.admin.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.admin])
    .rpc();
}

// Getters

export const getTreasury = (
    publicKey: web3.PublicKey,
    commitment?: web3.Commitment
): Promise<IdlAccounts<TreasuryVault>["treasury"]> => _program.account.treasury.fetch(publicKey, commitment);

export const getPayout = (
    publicKey: web3.PublicKey,
    commitment?: web3.Commitment
): Promise<IdlAccounts<TreasuryVault>["payout"]> => _program.account.payout.fetch(publicKey, commitment);

export const getUserRole = (
    publicKey: web3.PublicKey,
    commitment?: web3.Commitment
): Promise<IdlAccounts<TreasuryVault>["userRole"]> => _program.account.userRole.fetch(publicKey, commitment);

export const getWhitelistedRecipient = (
    publicKey: web3.PublicKey,
    commitment?: web3.Commitment
): Promise<IdlAccounts<TreasuryVault>["whitelistedRecipient"]> => _program.account.whitelistedRecipient.fetch(publicKey, commitment);
export module CslSplTokenGetters {
    export const getMint = (
        publicKey: web3.PublicKey,
        commitment?: web3.Commitment
    ): Promise<IdlAccounts<CslSplToken>["mint"]> => _programCslSplToken.account.mint.fetch(publicKey, commitment);
    
    export const getAccount = (
        publicKey: web3.PublicKey,
        commitment?: web3.Commitment
    ): Promise<IdlAccounts<CslSplToken>["account"]> => _programCslSplToken.account.account.fetch(publicKey, commitment);
}

