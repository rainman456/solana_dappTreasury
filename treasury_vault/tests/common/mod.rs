use {
	treasury_vault::{
			entry,
			ID as PROGRAM_ID,
	},
	solana_sdk::{
		entrypoint::{ProcessInstruction, ProgramResult},
		pubkey::Pubkey,
	},
	anchor_lang::prelude::AccountInfo,
	solana_program_test::*,
};

// Type alias for the entry function pointer used to convert the entry function into a ProcessInstruction function pointer.
pub type ProgramEntry = for<'info> fn(
	program_id: &Pubkey,
	accounts: &'info [AccountInfo<'info>],
	instruction_data: &[u8],
) -> ProgramResult;

// Macro to convert the entry function into a ProcessInstruction function pointer.
#[macro_export]
macro_rules! convert_entry {
	($entry:expr) => {
		// Use unsafe block to perform memory transmutation.
		unsafe { core::mem::transmute::<ProgramEntry, ProcessInstruction>($entry) }
	};
}

pub fn get_program_test() -> ProgramTest {
	let program_test = ProgramTest::new(
		"treasury_vault",
		PROGRAM_ID,
		processor!(convert_entry!(entry)),
	);
	program_test
}
	
pub mod treasury_vault_ix_interface {

	use {
		solana_sdk::{
			hash::Hash,
			signature::{Keypair, Signer},
			instruction::Instruction,
			pubkey::Pubkey,
			transaction::Transaction,
		},
		treasury_vault::{
			ID as PROGRAM_ID,
			accounts as treasury_vault_accounts,
			instruction as treasury_vault_instruction,
		},
		anchor_lang::{
			prelude::*,
			InstructionData,
		}
	};

	pub fn initialize_treasury_ix_setup(
		admin: &Keypair,
		treasury: Pubkey,
		system_program: Pubkey,
		mint: Option<Pubkey>,
		epoch_duration: i64,
		spending_limit: u64,
		token_gated_mint: Option<Pubkey>,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::InitializeTreasury {
			admin: admin.pubkey(),
			treasury: treasury,
			system_program: system_program,
		};

		let data = 	treasury_vault_instruction::InitializeTreasury {
				mint,
				epoch_duration,
				spending_limit,
				token_gated_mint,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&admin.pubkey()),
		);

		transaction.sign(&[
			&admin,
		], recent_blockhash);

		return transaction;
	}

	pub fn deposit_ix_setup(
		depositor: &Keypair,
		treasury: Pubkey,
		source: Pubkey,
		destination: Pubkey,
		authority: &Keypair,
		csl_spl_token_v0_0_0: Pubkey,
		mint: Option<Pubkey>,
		amount: u64,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::Deposit {
			depositor: depositor.pubkey(),
			treasury: treasury,
			source: source,
			destination: destination,
			authority: authority.pubkey(),
			csl_spl_token_v0_0_0: csl_spl_token_v0_0_0,
		};

		let data = 	treasury_vault_instruction::Deposit {
				mint,
				amount,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&depositor.pubkey()),
		);

		transaction.sign(&[
			&depositor,
			&authority,
		], recent_blockhash);

		return transaction;
	}

	pub fn schedule_payout_ix_setup(
		treasury: Pubkey,
		payout: Pubkey,
		authority: &Keypair,
		system_program: Pubkey,
		recipient: Pubkey,
		mint: Option<Pubkey>,
		amount: u64,
		scheduled_time: i64,
		recurring: bool,
		recurrence_interval: Option<i64>,
		recurrence_end_time: Option<i64>,
		id: u64,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::SchedulePayout {
			treasury: treasury,
			payout: payout,
			authority: authority.pubkey(),
			system_program: system_program,
		};

		let data = 	treasury_vault_instruction::SchedulePayout {
				recipient,
				mint,
				amount,
				scheduled_time,
				recurring,
				recurrence_interval,
				recurrence_end_time,
				id,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&treasury.pubkey()),
		);

		transaction.sign(&[
			&authority,
		], recent_blockhash);

		return transaction;
	}

	pub fn execute_payout_ix_setup(
		treasury: Pubkey,
		payout: Pubkey,
		authority: &Keypair,
		recipient: Pubkey,
		whitelist: Pubkey,
		source: Pubkey,
		destination: Pubkey,
		csl_spl_token_v0_0_0: Pubkey,
		mint: Option<Pubkey>,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::ExecutePayout {
			treasury: treasury,
			payout: payout,
			authority: authority.pubkey(),
			recipient: recipient,
			whitelist: whitelist,
			source: source,
			destination: destination,
			csl_spl_token_v0_0_0: csl_spl_token_v0_0_0,
		};

		let data = 	treasury_vault_instruction::ExecutePayout {
				mint,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&treasury.pubkey()),
		);

		transaction.sign(&[
			&authority,
		], recent_blockhash);

		return transaction;
	}

	pub fn update_admin_ix_setup(
		treasury: Pubkey,
		admin: &Keypair,
		new_admin: Pubkey,
		mint: Option<Pubkey>,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::UpdateAdmin {
			treasury: treasury,
			admin: admin.pubkey(),
		};

		let data = 	treasury_vault_instruction::UpdateAdmin {
				new_admin,
				mint,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&treasury.pubkey()),
		);

		transaction.sign(&[
			&admin,
		], recent_blockhash);

		return transaction;
	}

	pub fn add_treasurer_ix_setup(
		treasury: Pubkey,
		admin: &Keypair,
		user_role: Pubkey,
		system_program: Pubkey,
		user: Pubkey,
		mint: Option<Pubkey>,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::AddTreasurer {
			treasury: treasury,
			admin: admin.pubkey(),
			user_role: user_role,
			system_program: system_program,
		};

		let data = 	treasury_vault_instruction::AddTreasurer {
				user,
				mint,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&treasury.pubkey()),
		);

		transaction.sign(&[
			&admin,
		], recent_blockhash);

		return transaction;
	}

	pub fn remove_treasurer_ix_setup(
		treasury: Pubkey,
		admin: &Keypair,
		user_role: Pubkey,
		user: Pubkey,
		mint: Option<Pubkey>,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::RemoveTreasurer {
			treasury: treasury,
			admin: admin.pubkey(),
			user_role: user_role,
		};

		let data = 	treasury_vault_instruction::RemoveTreasurer {
				user,
				mint,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&treasury.pubkey()),
		);

		transaction.sign(&[
			&admin,
		], recent_blockhash);

		return transaction;
	}

	pub fn add_whitelist_ix_setup(
		treasury: Pubkey,
		admin: &Keypair,
		whitelist: Pubkey,
		system_program: Pubkey,
		recipient: Pubkey,
		mint: Option<Pubkey>,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::AddWhitelist {
			treasury: treasury,
			admin: admin.pubkey(),
			whitelist: whitelist,
			system_program: system_program,
		};

		let data = 	treasury_vault_instruction::AddWhitelist {
				recipient,
				mint,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&treasury.pubkey()),
		);

		transaction.sign(&[
			&admin,
		], recent_blockhash);

		return transaction;
	}

	pub fn remove_whitelist_ix_setup(
		treasury: Pubkey,
		admin: &Keypair,
		whitelist: Pubkey,
		recipient: Pubkey,
		mint: Option<Pubkey>,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::RemoveWhitelist {
			treasury: treasury,
			admin: admin.pubkey(),
			whitelist: whitelist,
		};

		let data = 	treasury_vault_instruction::RemoveWhitelist {
				recipient,
				mint,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&treasury.pubkey()),
		);

		transaction.sign(&[
			&admin,
		], recent_blockhash);

		return transaction;
	}

	pub fn update_spending_limit_ix_setup(
		treasury: Pubkey,
		admin: &Keypair,
		new_spending_limit: u64,
		mint: Option<Pubkey>,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::UpdateSpendingLimit {
			treasury: treasury,
			admin: admin.pubkey(),
		};

		let data = 	treasury_vault_instruction::UpdateSpendingLimit {
				new_spending_limit,
				mint,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&treasury.pubkey()),
		);

		transaction.sign(&[
			&admin,
		], recent_blockhash);

		return transaction;
	}

	pub fn update_epoch_duration_ix_setup(
		treasury: Pubkey,
		admin: &Keypair,
		new_epoch_duration: i64,
		mint: Option<Pubkey>,
		recent_blockhash: Hash,
	) -> Transaction {
		let accounts = treasury_vault_accounts::UpdateEpochDuration {
			treasury: treasury,
			admin: admin.pubkey(),
		};

		let data = 	treasury_vault_instruction::UpdateEpochDuration {
				new_epoch_duration,
				mint,
		};		let instruction = Instruction::new_with_bytes(PROGRAM_ID, &data.data(), accounts.to_account_metas(None));
		let mut transaction = Transaction::new_with_payer(
			&[instruction], 
			Some(&treasury.pubkey()),
		);

		transaction.sign(&[
			&admin,
		], recent_blockhash);

		return transaction;
	}

}

pub mod csl_spl_token_ix_interface {

	use {
		solana_sdk::{
			hash::Hash,
			signature::{Keypair, Signer},
			instruction::Instruction,
			pubkey::Pubkey,
			transaction::Transaction,
		},
		csl_spl_token::{
			ID as PROGRAM_ID,
			accounts as csl_spl_token_accounts,
			instruction as csl_spl_token_instruction,
		},
		anchor_lang::{
			prelude::*,
			InstructionData,
		}
	};

	declare_id!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

}
