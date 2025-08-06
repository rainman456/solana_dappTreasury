import {PublicKey} from "@solana/web3.js";
import {BN} from "@coral-xyz/anchor";

export type TreasurySeeds = {
    mint: PublicKey, 
};

export const deriveTreasuryPDA = (
    seeds: TreasurySeeds,
    programId: PublicKey
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("treasury"),
            seeds.mint.toBuffer(),
        ],
        programId,
    )
};

export type PayoutSeeds = {
    treasury: PublicKey, 
    recipient: PublicKey, 
    id: bigint, 
};

export const derivePayoutPDA = (
    seeds: PayoutSeeds,
    programId: PublicKey
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("payout"),
            seeds.treasury.toBuffer(),
            seeds.recipient.toBuffer(),
            Buffer.from(BigUint64Array.from([seeds.id]).buffer),
        ],
        programId,
    )
};

export type UserRoleSeeds = {
    treasury: PublicKey, 
    user: PublicKey, 
};

export const deriveUserRolePDA = (
    seeds: UserRoleSeeds,
    programId: PublicKey
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("role"),
            seeds.treasury.toBuffer(),
            seeds.user.toBuffer(),
        ],
        programId,
    )
};

export type WhitelistSeeds = {
    treasury: PublicKey, 
    recipient: PublicKey, 
};

export const deriveWhitelistPDA = (
    seeds: WhitelistSeeds,
    programId: PublicKey
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("whitelist"),
            seeds.treasury.toBuffer(),
            seeds.recipient.toBuffer(),
        ],
        programId,
    )
};

export module CslSplTokenPDAs {
    export type AccountSeeds = {
        wallet: PublicKey, 
        tokenProgram: PublicKey, 
        mint: PublicKey, 
    };
    
    export const deriveAccountPDA = (
        seeds: AccountSeeds,
        programId: PublicKey
    ): [PublicKey, number] => {
        return PublicKey.findProgramAddressSync(
            [
                seeds.wallet.toBuffer(),
                seeds.tokenProgram.toBuffer(),
                seeds.mint.toBuffer(),
            ],
            programId,
        )
    };
    
}

