#!/usr/bin/env bash

# Create directories if they don't exist
mkdir -p test_holding

mkdir -p tests


# Make sure test_utils.ts exists in both test directories
if [ ! -f "tests/test_utils.ts" ]; then
  echo "Error: tests/test_utils.ts not found!"
  exit 1
fi



# Move all test files from tests and test2 to their respective holding folders
# but exclude test_utils.ts
if [ "$(ls -A tests2/*.ts 2>/dev/null)" ]; then
  echo "Moving test files from tests to holding folder..."
  for file in tests2/*.ts; do
    if [ "$(basename "$file")" != "test_utils.ts" ]; then
      mv "$file" test_holding/
    fi
  done
fi



# Array of test files from test2 folder in the order they should be run


# Array of test files from tests folder in the order they should be run
test_files=(
    "treasury_vault_sol_operations.ts"
  "treasury_vault_spl_failures.ts"
   "treasury_vault_basic_spl.ts"
    "treasury_vault_spl_edge_cases.ts"
    "treasury_vault_spl_payouts.ts"
)




# Run each test file from tests folder
echo "Running tests from tests folder..."
for test_file in "${test_files[@]}"; do
  if [ -f "test_holding/$test_file" ]; then
    echo "========================================================"
    echo "Running test: $test_file (from tests)"
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

# Move all test files back to their respective directories
echo "Moving test files back to tests2 folder..."
mv test_holding/*.ts tests2/



echo "All tests completed!"