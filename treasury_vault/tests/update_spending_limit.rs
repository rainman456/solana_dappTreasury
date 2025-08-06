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
async fn update_spending_limit_ix_success() {
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

	// DATA
	let new_spending_limit: u64 = Default::default();
	let mint = None;

	// KEYPAIR
	let admin_keypair = Keypair::new();

	// PUBKEY
	let admin_pubkey = admin_keypair.pubkey();

	// PDA
	let (treasury_pda, _treasury_pda_bump) = Pubkey::find_program_address(
		&[
			b"treasury",
			mint.as_ref(),
		],
		&treasury_vault::ID,
	);

	// ACCOUNT PROGRAM TEST SETUP
	program_test.add_account(
		admin_pubkey,
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

	let ix = treasury_vault_ix_interface::update_spending_limit_ix_setup(
		treasury_pda,
		&admin_keypair,
		new_spending_limit,
		mint,
		recent_blockhash,
	);

	let result = banks_client.process_transaction(ix).await;

	// ASSERTIONS
	assert!(result.is_ok());

}
