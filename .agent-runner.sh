#!/bin/bash
cd "$(dirname "$0")"
export https_proxy="${AGENT_HTTPS_PROXY:-}"
export http_proxy="${AGENT_HTTP_PROXY:-}"
export all_proxy="${AGENT_ALL_PROXY:-}"
export CLAUDE_NON_INTERACTIVE=1

claude -p --agent dispatch --session-id "c2b02e46-ae63-4a2f-9916-047890d24a25" --dangerously-skip-permissions --output-format stream-json --verbose "Start the pipeline"
