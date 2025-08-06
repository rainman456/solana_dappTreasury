pub mod common;

use std::str::FromStr;
use {
    common::{
		get_program_test,
		treasury_vault_ix_interface,
		csl_spl_token_ix_interface,
	},
    solana_program_test::tokio,
    solana_sdk::{
        account::Account, pubkey::Pubkey, rent::Rent, signature::Keypair, signer::Signer, system_program,
    },
};


#[tokio::test]
async fn execute_payout_ix_success() {
	let mut program_test = get_program_test();

	// PROGRAMS
	program_test.prefer_bpf(true);

	program_test.add_program(
		"account_compression",
		Pubkey::from_str("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK").unwrap(),
		None,
	);

	program_test.add_program(
		"noop",
		Pubkey::from_str("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV").unwrap(),
		None,
	);

	program_test.add_program(
		"csl_spl_token",
		Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap(),
		None,
	);

	// DATA
	let mint = None;

	// KEYPAIR
	let authority_keypair = Keypair::new();

	// PUBKEY
	let authority_pubkey = authority_keypair.pubkey();
	let recipient_pubkey = Pubkey::new_unique();
	let source_pubkey = Pubkey::new_unique();
	let destination_pubkey = Pubkey::new_unique();

	// EXECUTABLE PUBKEY
	let csl_spl_token_v0_0_0_pubkey = Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap();

	// PDA
	let (treasury_pda, _treasury_pda_bump) = Pubkey::find_program_address(
		&[
			b"treasury",
			mint.as_ref(),
		],
		&treasury_vault::ID,
	);

	let (payout_pda, _payout_pda_bump) = Pubkey::find_program_address(
		&[
			b"payout",
			treasury_pubkey.as_ref(),
			recipient_pubkey.as_ref(),
			payout_seed_id.to_le_bytes().as_ref(),
		],
		&treasury_vault::ID,
	);

	let (whitelist_pda, _whitelist_pda_bump) = Pubkey::find_program_address(
		&[
			b"whitelist",
			treasury_pubkey.as_ref(),
			recipient_pubkey.as_ref(),
		],
		&treasury_vault::ID,
	);

	// ACCOUNT PROGRAM TEST SETUP
	program_test.add_account(
		authority_pubkey,
		Account {
			lamports: 1_000_000_000_000,
			data: vec![],
			owner: treasury_vault_ix_interface::ID,
			executable: false,
			rent_epoch: 0,
		},
	);

	// INSTRUCTIONS
	let (mut banks_client, _, recent_blockhash) = program_test.start().await;

	let ix = treasury_vault_ix_interface::execute_payout_ix_setup(
		treasury_pda,
		payout_pda,
		&authority_keypair,
		recipient_pubkey,
		whitelist_pda,
		source_pubkey,
		destination_pubkey,
		csl_spl_token_v0_0_0_pubkey,
		mint,
		recent_blockhash,
	);

	let result = banks_client.process_transaction(ix).await;

	// ASSERTIONS
	assert!(result.is_ok());

}
