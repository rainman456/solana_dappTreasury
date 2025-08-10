#!/usr/bin/env bash

# Create directories if they don't exist
mkdir -p test_holding
mkdir -p tests

# Move all test files from tests to test_holding
if [ "$(ls -A tests/*.ts 2>/dev/null)" ]; then
  echo "Moving test files to holding folder..."
  mv tests/*.ts test_holding/
fi

# Array of test files in the order they should be run
test_files=(
  "treasury_vault.ts"
  "treasury_vault_edge_cases.ts"
  "treasury_vault_payout.ts"
  "treasury_vault_user_management.ts"
  "treasury_vault_pause_and_limits.ts"
  "treasury_vault_token_gate.ts"
)

# Add optional test files if they exist
for optional_test in "treasury_vault_role_permissions_tests.ts" "treasury_vault_payout_tests.ts" "treasury_vault_whitelist_tests.ts"; do
  if [ -f "test_holding/$optional_test" ]; then
    test_files+=("$optional_test")
  fi
done

# Run each test file
for test_file in "${test_files[@]}"; do
  if [ -f "test_holding/$test_file" ]; then
    echo "========================================================"
    echo "Running test: $test_file"
    echo "========================================================"
    
    # Copy just this test file to the tests directory
    cp "test_holding/$test_file" tests/
    
    # Run the test using anchor test
    anchor test
    
    # Remove the test file from tests directory
    rm "tests/$test_file"
    
    # Wait for the validator to clean up
    sleep 2
  else
    echo "File test_holding/$test_file not found, skipping..."
  fi
done

# Move all test files back to the tests directory
echo "Moving test files back to tests folder..."
mv test_holding/*.ts tests/

echo "All tests completed!"