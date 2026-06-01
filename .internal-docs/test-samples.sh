#!/bin/bash
# Test DepGuarder against sample projects

CLI_PATH=$(pwd)/packages/cli/dist/index.js

echo "--- Testing CLEAN-APP ---"
cd samples/clean-app
node $CLI_PATH scan
node $CLI_PATH explain lodash

echo -e "\n--- Testing RISKY-APP ---"
cd ../risky-app
node $CLI_PATH scan
node $CLI_PATH explain browserlist
