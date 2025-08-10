# On-Chain Treasury Smart Contract for Solana

## Project Overview

This project is a Solana smart contract developed for the Código DevQuest, a collaboration between Código and Superteam Nigeria. The program implements an on-chain treasury vault to manage SOL and SPL tokens, tailored for DAOs, guilds, or communities to handle recurring contributor payments, community grants, or time-locked funding rounds. Built using the Anchor framework and Código’s AI-powered development platform, the program offers robust features, comprehensive unit tests, and creative enhancements to ensure reusability and scalability.

### Features
- **Treasury Management**: Securely stores SOL or SPL tokens with programmable payout logic.
- **Deposits**: Allows any user to deposit funds into the treasury.
- **Scheduled Payouts**: Supports one-time or recurring payouts to whitelisted recipients, requiring admin or treasurer approval.
- **Role-Based Permissions**: Restricts sensitive actions (e.g., payouts, configuration changes) to admin or treasurer roles.
- **Spending Limits**: Enforces a maximum spending limit per epoch, with automatic resets.
- **Recipient Whitelisting**: Limits payouts to approved addresses.
- **Token-Gated Access**: Optionally requires users to hold a specific SPL token for withdrawals.
- **Creative Features**:
  - **Pause/Unpause**: Enables admins to freeze or resume payouts for security (e.g., during suspected attacks).
  - **Audit Logging**: Records all treasury actions (deposits, payouts, permission changes) for transparency.
  - **Dynamic Epoch Adjustment**: Allows admins to modify epoch duration via a governance-like mechanism.
- **Unit Tests**: Comprehensive TypeScript tests verify all functionality, including edge cases.

The program is designed to be secure, extensible, and reusable, serving as a valuable template for Solana projects managing community funds.

## Setup Instructions

### Prerequisites
- A Solana wallet with a public address for deployment and testing (Devnet recommended).
- Internet connection for downloading dependencies.

### Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/rainman456/solana_dappTreasury.git
   cd solana_dappTreasury
   ```

2. **Run Setup Script**:
   - For **Linux** (including WSL on Windows) or **macOS**:
     ```bash
     chmod +x setup.sh
     ./setup.sh
     ```
   - For **Windows**:
     - Install WSL (Windows Subsystem for Linux) by running `wsl --install` in PowerShell, then use Ubuntu.
     - In the Ubuntu terminal, run the commands above.
   - The `setup.sh` script installs Rust, Solana CLI, Anchor CLI (version 0.31.1), Node.js, and Yarn, configuring the environment for Solana development.

3. **Set Up Solana Environment**:
   - Configure Solana CLI for Devnet:
     ```bash
     solana config set --url https://api.devnet.solana.com
     ```
   - Generate or use an existing keypair:
     ```bash
     solana-keygen new
     ```

4. **Build the Program**:
   - Compile the Rust program:
     ```bash
     anchor build
     ```
   - The output will be in `target/deploy/treasury_vault.so`.

5. **Run Unit Tests**:
   - Execute tests using the provided script, which runs TypeScript tests across multiple test folders (`tests/`):
     ```bash
     chmod +x run_tests.sh
     ./run_tests.sh
     ```
   - Tests require a local Solana validator (`solana-test-validator`) or a Devnet connection.

6. **Deploy to Devnet**:
   - Deploy the program:
     ```bash
     solana program deploy target/deploy/treasury_vault.so
     ```
   - Note the program ID for use in the TypeScript client (`program_client/app.ts`).

## Project Structure
- `Anchor.toml`: Anchor configuration file.
- `Cargo.toml` & `Cargo.lock`: Rust dependency management.
- `clean.sh`: Script to clean build artifacts.
- `programs/treasury_vault/`: Rust source code for the treasury vault program.
- `tests/`: TypeScript unit tests for various functionalities.
- `run_tests.sh`: Script to execute all unit tests.
- `program_client/app.ts`: TypeScript client for interacting with the deployed program.
- `tsconfig.json` & `package.json`: Configuration for TypeScript and Node.js dependencies.

## Code Generation Prompt
The following CIDL prompt was used on the Código platform to generate the smart contract and client code:

**Prompt**:
```
Create a Solana smart contract using the Anchor framework for an on-chain treasury vault to manage SOL and SPL tokens. The program should support treasury initialization, deposits, scheduled payouts (one-time or recurring), role-based permissions (admin/treasurer), spending limits per epoch, recipient whitelisting, token-gated access, pause/unpause functionality, dynamic epoch adjustment, and audit logging. Include comprehensive TypeScript unit tests for all functionality and edge cases.
```

## Edge Case Testing
The unit tests in the `tests/` directory cover the following edge cases to ensure robustness:
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
  - Attempting execution before the scheduled time.
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

These tests ensure the program handles errors securely and gracefully.

## Extra Creative Features
To enhance functionality and meet the DevQuest’s imaginativity criterion, the following features were added:
- **Pause/Unpause Mechanism**:
  - Admins can pause the treasury to prevent payouts during emergencies (e.g., suspected exploits).
  - Unpausing requires admin approval for secure recovery.
- **Audit Logging**:
  - Logs all actions (deposits, payouts, permission changes) in an on-chain `AuditLog` struct with timestamps and details for transparency.
- **Dynamic Epoch Adjustment**:
  - Admins can modify epoch duration (e.g., weekly to monthly) to adapt to governance needs, with validation to prevent invalid durations.
- **Multi-Signature Payout Approval** (Optional):
  - Extends the treasurer role to require multiple approvals for high-value payouts, enhancing security.

These features make the treasury flexible, secure, and suitable for real-world Solana projects like DAOs or community funds.

## Solana Wallet Address
**Wallet Address**: 9JrvTEYhmiMteeWz7h9XtsFdufYHa5tzJLCSk7C9Fgob

## Feedback on Código Platform
Código’s AI code generation was intuitive, producing accurate Anchor boilerplate and saving development time. The integrated Solana tools streamlined the process, though debugging complex logic and larger codebases posed challenges. These were resolved by ensuring Código’s AI followed the program’s structure, goals, and TypeScript unit test patterns, with thorough debugging when necessary.

## Usage
A frontend client is not currently included. To interact with the deployed program:
1. Create `program_client/app.ts` after deployment.
2. Run the client script:
   ```bash
   node program_client/app.ts
   ```
3. Example interactions:
   - **Initialize**: Set up the treasury with an admin, token mint, and spending limit.
   - **Deposit**: Transfer SOL or SPL tokens to the treasury.
   - **Schedule Payout**: Define a recurring payment to a contributor.
   - **Execute Payout**: Process a scheduled payout when conditions are met.

## Contributing
This program is designed for reuse by the Solana community. To contribute:
- Fork the repository and submit pull requests with enhancements.
- Suggested improvements:
  - Integration with governance tokens for voting on payouts.
  - Support for multi-token treasuries.
  - Advanced audit log querying.

## License
This project is licensed under the MIT License, making it freely reusable for Solana developers and projects.
