#!/bin/bash
# Test SDK with clean environment

# Unset problematic vars
unset CLAUDE_CODE_ENTRYPOINT
unset CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
unset CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
unset CLAUDE_CODE_ATTRIBUTION_HEADER
unset CLAUDECODE

# Run the test
node "$(dirname "$0")/test-sdk.mjs"
