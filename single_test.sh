#!/usr/bin/env bash

# Check if a test file name was provided
if [ -z "$1" ]; then
  echo "Error: No test file specified"
  echo "Usage: $0 <test_file.ts>"
  exit 1
fi

TEST_FILE="$1"

# Check if the test file exists in test1 or test2 folder
if [ -f "tests1/$TEST_FILE" ]; then
  SOURCE_FOLDER="tests1"
  echo "Found $TEST_FILE in test1 folder"
elif [ -f "tests2/$TEST_FILE" ]; then
  SOURCE_FOLDER="tests2"
  echo "Found $TEST_FILE in test2 folder"
else
  echo "Error: Test file $TEST_FILE not found in either test1 or test2 folder"
  exit 1
fi

# Make sure test_utils.ts exists in the tests folder
if [ ! -f "tests/test_utils.ts" ]; then
  echo "Warning: test_utils.ts not found in tests folder"
  
  # Try to find test_utils.ts in the source folder
  if [ -f "$SOURCE_FOLDER/test_utils.ts" ]; then
    echo "Copying test_utils.ts from $SOURCE_FOLDER to tests folder"
    cp "$SOURCE_FOLDER/test_utils.ts" "tests/test_utils.ts"
  else
    echo "Error: test_utils.ts not found in $SOURCE_FOLDER folder"
    exit 1
  fi
fi

# Copy the test file to the tests folder
echo "Copying $TEST_FILE from $SOURCE_FOLDER to tests folder"
cp "$SOURCE_FOLDER/$TEST_FILE" "tests/$TEST_FILE"

# Run anchor test
echo "========================================================"
echo "Running test: $TEST_FILE (from $SOURCE_FOLDER)"
echo "========================================================"
anchor test

# Check if the test was successful
TEST_RESULT=$?

# Remove the test file from the tests folder
echo "Removing $TEST_FILE from tests folder"
rm "tests/$TEST_FILE"

echo "Test completed with exit code: $TEST_RESULT"
if [ $TEST_RESULT -eq 0 ]; then
  echo "Test passed!"
else
  echo "Test failed!"
fi

# Return the test result
exit $TEST_RESULT