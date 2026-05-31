#!/bin/bash
# Upload files to ci-assets branch using Git Data API
# Usage: source upload-ci-assets.sh
#        upload_to_ci_assets "android/12345" file1.jpg file2.jpg ...
#
# Environment variables required:
#   GITHUB_REPOSITORY  - Repository in format owner/repo
#   GITHUB_TOKEN       - GitHub token with contents:write permission
#
# Returns:
#   0 - success, UPLOADED_URLS array contains raw URLs
#   1 - permanent failure
#   2 - race condition (caller should retry)

# JSON parsing helper
_json_get() {
  local json="$1" key="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$key // empty"
  else
    echo "$json" | grep -oE "\"$key\":\s*\"[^\"]+\"" | head -1 | cut -d'"' -f4
  fi
}

# Upload files to ci-assets branch
# Args: upload_dir file1 file2 ...
# Sets: UPLOADED_URLS (array of raw URLs)
upload_to_ci_assets() {
  local upload_dir="$1"
  shift
  local files=("$@")

  [ -z "${GITHUB_REPOSITORY:-}" ] && { echo "::error::GITHUB_REPOSITORY not set" >&2; return 1; }
  [ -z "${GITHUB_TOKEN:-}" ] && { echo "::error::GITHUB_TOKEN not set" >&2; return 1; }
  [ ${#files[@]} -eq 0 ] && { echo "::error::No files to upload" >&2; return 1; }

  local api_base="https://api.github.com/repos/${GITHUB_REPOSITORY}"
  local auth_header="Authorization: token ${GITHUB_TOKEN}"
  local branch="ci-assets"
  local temp_dir
  temp_dir=$(mktemp -d)

  # Step 1: Get current commit SHA
  local ref_response base_sha
  ref_response=$(curl -s -H "$auth_header" "${api_base}/git/ref/heads/${branch}")
  base_sha=$(_json_get "$ref_response" "object.sha")
  [ -z "$base_sha" ] && base_sha=$(echo "$ref_response" | grep -oE '"sha":\s*"[a-f0-9]+"' | head -1 | cut -d'"' -f4)
  [ -z "$base_sha" ] && { echo "::error::Failed to get base SHA for ${branch}" >&2; rm -rf "$temp_dir"; return 1; }

  # Step 2: Get base tree SHA
  local commit_response base_tree
  commit_response=$(curl -s -H "$auth_header" "${api_base}/git/commits/${base_sha}")
  if command -v jq &>/dev/null; then
    base_tree=$(echo "$commit_response" | jq -r '.tree.sha // empty')
  else
    base_tree=$(echo "$commit_response" | grep -oE '"tree":\s*\{[^}]*"sha":\s*"[a-f0-9]+"' | grep -oE '"sha":\s*"[a-f0-9]+"' | cut -d'"' -f4)
  fi
  [ -z "$base_tree" ] && { echo "::error::Failed to get base tree" >&2; rm -rf "$temp_dir"; return 1; }

  # Step 3: Create blobs
  local tree_entries="["
  UPLOADED_URLS=()
  local uploaded_names=()

  for file in "${files[@]}"; do
    [ ! -f "$file" ] && continue
    local name
    name=$(basename "$file")
    local content
    content=$(base64 -w 0 "$file" 2>/dev/null || base64 -i "$file" 2>/dev/null | tr -d '\n' || base64 "$file" | tr -d '\n')

    local blob_payload="$temp_dir/blob_${name}.json"
    printf '{"content":"%s","encoding":"base64"}' "$content" > "$blob_payload"

    local blob_response blob_sha
    blob_response=$(curl -s -X POST "${api_base}/git/blobs" -H "$auth_header" -H "Content-Type: application/json" -d @"$blob_payload")
    blob_sha=$(_json_get "$blob_response" "sha")

    if [ -n "$blob_sha" ]; then
      [ ${#uploaded_names[@]} -gt 0 ] && tree_entries="${tree_entries},"
      tree_entries="${tree_entries}{\"path\":\"${upload_dir}/${name}\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"${blob_sha}\"}"
      uploaded_names+=("$name")
      UPLOADED_URLS+=("https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${branch}/${upload_dir}/${name}")
    fi
  done

  tree_entries="${tree_entries}]"
  rm -rf "$temp_dir"

  [ ${#uploaded_names[@]} -eq 0 ] && { echo "::error::No blobs created" >&2; return 1; }

  # Step 4: Create tree
  local tree_response tree_sha
  tree_response=$(curl -s -X POST "${api_base}/git/trees" -H "$auth_header" -H "Content-Type: application/json" -d "{\"base_tree\":\"${base_tree}\",\"tree\":${tree_entries}}")
  tree_sha=$(_json_get "$tree_response" "sha")
  [ -z "$tree_sha" ] && { echo "::error::Failed to create tree" >&2; return 1; }

  # Step 5: Create commit
  local commit_msg="Add ${#uploaded_names[@]} files to ${upload_dir}"
  local commit_create_response commit_sha
  commit_create_response=$(curl -s -X POST "${api_base}/git/commits" -H "$auth_header" -H "Content-Type: application/json" -d "{\"message\":\"${commit_msg}\",\"tree\":\"${tree_sha}\",\"parents\":[\"${base_sha}\"]}")
  commit_sha=$(_json_get "$commit_create_response" "sha")
  [ -z "$commit_sha" ] && { echo "::error::Failed to create commit" >&2; return 1; }

  # Step 6: Update branch reference
  local update_response http_code
  update_response=$(curl -s -w "\n%{http_code}" -X PATCH "${api_base}/git/refs/heads/${branch}" -H "$auth_header" -H "Content-Type: application/json" -d "{\"sha\":\"${commit_sha}\",\"force\":false}")
  http_code=$(echo "$update_response" | tail -1)
  [ "$http_code" != "200" ] && { echo "::warning::Ref update HTTP $http_code" >&2; return 2; }

  return 0
}

# Upload with retry logic
# Args: upload_dir file1 file2 ...
# Sets: UPLOADED_URLS (array of raw URLs)
upload_to_ci_assets_with_retry() {
  local max_retries=3
  local attempt

  for attempt in $(seq 1 $max_retries); do
    if upload_to_ci_assets "$@"; then
      return 0
    else
      local exit_code=$?
      if [ $exit_code -eq 2 ] && [ $attempt -lt $max_retries ]; then
        echo "::warning::Upload attempt $attempt failed (race condition), retrying..." >&2
        sleep "$attempt"
      elif [ $attempt -eq $max_retries ]; then
        echo "::error::Failed after $max_retries attempts" >&2
        return 1
      else
        return 1
      fi
    fi
  done
}
