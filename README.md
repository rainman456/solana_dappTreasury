# On-Chain Treasury Smart Contract for Solana

## Project Overview

This project is a Solana smart contract (program) developed for the **Código DevQuest**, a collaboration between Código and Superteam Nigeria. The program implements an **on-chain treasury vault** to manage SOL and SPL tokens, designed for DAOs, guilds, or communities to handle recurring contributor payments, community grants, or time-locked funding rounds. Built using the Anchor framework and Código’s AI-powered development platform, the program includes robust features, comprehensive unit tests, and creative enhancements to ensure reusability and scalability.

### Features
- **Treasury Management**: Stores SOL or SPL tokens in a secure vault with programmable payout logic.
- **Deposits**: Allows any user to deposit funds into the treasury.
- **Scheduled Payouts**: Supports one-time or recurring payouts to whitelisted recipients, with admin or treasurer approval.
- **Role-Based Permissions**: Restricts sensitive actions (e.g., payouts, configuration) to admin or treasurer roles.
- **Spending Limits**: Enforces a maximum spending limit per epoch, with automatic resets.
- **Recipient Whitelisting**: Restricts payouts to approved addresses.
- **Token-Gated Access**: Optionally requires users to hold a specific SPL token for withdrawals.
- **Creative Features**:
  - **Pause/Unpause**: Admin can freeze/unfreeze payouts for security (e.g., during a suspected attack).
  - **Audit Logging**: Records all treasury actions (deposits, payouts, permission changes) for transparency.
  - **Dynamic Epoch Adjustment**: Allows admins to update epoch duration via a governance-like mechanism.
- **Unit Tests**: Comprehensive TypeScript tests verify all functionality, including edge cases.

The program is designed to be reusable, secure, and extensible, making it a valuable template for Solana projects managing community funds.

## Setup Instructions

### Prerequisites
- **Rust**: Install Rust via `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.
- **Solana CLI**: Install with `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`.
- **Anchor Framework**: Install Anchor CLI: `cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked`.
- **Node.js**: Required for TypeScript unit tests (version 16+ recommended).
- **Código Platform**: Sign up at [codigo.ai](https://codigo.ai) for code generation and development.
- **Solana Wallet**: A Solana wallet with a public address for deployment and testing (Devnet recommended).

### Installation
1. **Clone the Repository**:
   ```bash
   git clone <your-github-repo-url>
   cd <repository-name>
   ```
2. **Install Dependencies**:
   - Install Anchor dependencies: `cargo build`.
   - Install Node.js dependencies for tests: `npm install` in the `program_client` directory.
3. **Set Up Solana Environment**:
   - Configure Solana CLI for Devnet: `solana config set --url https://api.devnet.solana.com`.
   - Ensure you have a keypair: `solana-keygen new` (or use an existing one).
4. **Build the Program**:
   - Compile the Rust program: `anchor build`.
   - Output will be in `target/deploy/treasury.so`.
5. **Run Unit Tests**:
   - Execute TypeScript tests: `anchor test` (requires a local Solana validator or Devnet connection).
6. **Deploy to Devnet**:
   - Deploy the program: `solana program deploy target/deploy/treasury.so`.
   - Note the program ID for use in the TypeScript client (`program_client/app.ts`).

### Project Structure
```
├── Anchor.toml          # Anchor configuration
├── program              # Rust smart contract code
│   ├── src
│   │   ├── lib.rs       # Program entrypoint
│   │   ├── initialize.rs # Initialize treasury
│   │   ├── deposit.rs   # Deposit funds
│   │   ├── schedule_payout.rs # Schedule payouts
│   │   ├── execute_payout.rs  # Execute payouts
│   │   ├── update_permissions.rs # Manage roles and whitelist
│   │   ├── set_spending_limit.rs # Update spending limit
│   │   ├── check_token_gated_access.rs # Token-gated withdrawal check
├── program_client       # TypeScript client library
│   ├── app.ts           # Client interaction script
│   ├── tests
│   │   ├── treasury.ts  # Unit tests
├── tests                # Rust tests (optional)
└── README.md            # This file
```

## Code Generation Prompt

The following CIDL prompt was used on the Código platform to generate the smart contract and client code:

**Prompt Used**:
```
[Insert the CIDL prompt used to generate the code. Example: "Create a Solana smart contract for an on-chain treasury vault using the Anchor framework to manage SOL and SPL tokens..."]
```

**Note**: The actual prompt is included in the project’s `treasury.cidl` file and was used to generate complete business logic, including data structures, instructions, error handling, and TypeScript unit tests.

## Edge Case Testing

The unit tests (`program_client/tests/treasury.ts`) cover the following edge cases to ensure robustness:
- **Initialization**:
  - Invalid epoch duration (e.g., 0 seconds).
  - Non-signer attempting to initialize.
- **Deposits**:
  - Zero-amount deposits.
  - Insufficient funds in the depositor’s account.
- **Payout Scheduling**:
  - Scheduling by non-authorized accounts (non-admin/treasurer).
  - Invalid recipient (not in whitelist, if enforced).
  - Zero-amount or invalid start time.
- **Payout Execution**:
  - Attempting to execute before the scheduled time.
  - Exceeding the epoch spending limit.
  - Non-authorized caller attempting execution.
  - Payout to a non-whitelisted recipient.
  - Token-gated access failure (missing required tokens).
- **Permissions**:
  - Non-admin attempting to update permissions or spending limits.
  - Adding/removing invalid accounts to whitelist or roles.
- **Pause/Unpause**:
  - Executing payouts while paused.
  - Non-admin attempting to pause/unpause.
- **Epoch Management**:
  - Spending limit reset before/after epoch boundary.
  - Invalid epoch duration updates.

These tests ensure the program handles errors gracefully and maintains security under various conditions.

## Extra Creative Features

To enhance the treasury’s functionality and align with the DevQuest’s imaginativity criterion, the following features were added:
1. **Pause/Unpause Mechanism**:
   - Admins can pause the treasury to prevent payouts during emergencies (e.g., suspected exploits).
   - Unpausing requires admin approval, ensuring secure recovery.
2. **Audit Logging**:
   - All actions (deposits, payouts, permission changes) are logged in an on-chain `AuditLog` struct with timestamps and details.
   - Enables transparency for DAO members or community audits.
3. **Dynamic Epoch Adjustment**:
   - Admins can update the epoch duration (e.g., from weekly to monthly) to adapt to governance needs.
   - Includes validation to prevent overly short or long epochs.
4. **Multi-Signature Payout Approval** (Optional):
   - Extends the treasurer role to require multiple approvals for high-value payouts, enhancing security.

These features make the treasury more flexible, secure, and appealing for real-world Solana projects like DAOs or community funds.

## Solana Wallet Address

**Wallet Address**: `[Insert your Solana wallet address here]`

## Feedback on Código Platform

[Insert your feedback on the Código platform here. Example: "Código’s AI code generation was intuitive and saved time by producing accurate Anchor boilerplate. The integrated Solana tools streamlined development, though I encountered minor issues with debugging complex logic. Suggestions include improving error messages in the CIDL generator."]

## Usage

To interact with the deployed program:
1. Update `program_client/app.ts` with the program ID from deployment.
2. Run the client script: `node program_client/app.ts`.
3. Example interactions:
   - Initialize: Set up the treasury with an admin, token mint, and spending limit.
   - Deposit: Transfer SOL or SPL tokens to the treasury.
   - Schedule Payout: Define a recurring payment to a contributor.
   - Execute Payout: Process a scheduled payout when conditions are met.

## Contributing

This program is designed for reuse by the Solana community. To contribute:
- Fork the repository and submit pull requests with enhancements.
- Suggested improvements:
  - Integration with governance tokens for voting on payouts.
  - Support for multi-token treasuries.
  - Advanced audit log querying.

## License

This project is licensed under the MIT License, making it freely reusable for Solana developers and projects.
