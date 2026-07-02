#!/bin/bash
# Add missing dashboard.admin keys to locale files.
# Only modifies files that don't already have the new keys.

LOCALES_DIR="D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/i18n/locales"

process_file() {
  local file="$1"
  local base
  base=$(basename "$file")

  # Check if file already has totalComments (one of the new keys)
  if grep -q '"totalComments"' "$file" 2>/dev/null; then
    echo "  SKIP $base: already has new keys"
    return
  fi

  local tmp="$file.tmp"
  local in_actions=0
  local in_entity_types=0
  local totalUsers_done=0
  local unban_done=0
  local report_done=0

  while IFS= read -r line; do
    # Check if we're entering actions section
    if [ "$line" = '      "actions": {' ]; then
      in_actions=1
    fi

    # Check if we're entering entityTypes section
    if [ "$line" = '      "entityTypes": {' ]; then
      in_entity_types=1
    fi

    # Add new stat keys after totalUsers
    if [ $totalUsers_done -eq 0 ] && echo "$line" | grep -q '"totalUsers":'; then
      echo "$line"
      echo '      "totalPublishedPages": "Published Pages",'
      echo '      "totalMoments": "Moments",'
      echo '      "totalPackages": "Total Packages",'
      echo '      "newUsersToday": "New Users (Today)",'
      echo '      "newUsersThisWeek": "New Users (Week)",'
      echo '      "totalDownloads": "Total Downloads",'
      echo '      "totalComments": "Total Comments",'
      totalUsers_done=1
      continue
    fi

    # Add hide/unhide after unban in actions section
    if [ $in_actions -eq 1 ] && [ $unban_done -eq 0 ] && echo "$line" | grep -q '"unban":'; then
      echo "$line"
      echo '        "hide": "hide",'
      echo '        "unhide": "unhide"'
      unban_done=1
      continue
    fi

    # Add moment/published_page after report in entityTypes section
    if [ $in_entity_types -eq 1 ] && [ $report_done -eq 0 ] && echo "$line" | grep -q '"report":'; then
      echo "$line"
      echo '        "moment": "Moment",'
      echo '        "published_page": "Page"'
      report_done=1
      continue
    fi

    # Track when we leave actions section
    if [ $in_actions -eq 1 ] && echo "$line" | grep -q '^\s*\},$' && [ $unban_done -eq 1 ]; then
      in_actions=0
    fi

    # Track when we leave entityTypes section
    if [ $in_entity_types -eq 1 ] && echo "$line" | grep -q '^\s*\},$' && [ $report_done -eq 1 ]; then
      in_entity_types=0
    fi

    echo "$line"
  done < "$file" > "$tmp"

  mv "$tmp" "$file"
  echo "  DONE $base"
}

# Process all non-en, non-zh-CN locale files
for f in "$LOCALES_DIR"/*.json; do
  base=$(basename "$f")
  case "$base" in
    en.json|zh-CN.json)
      echo "  SKIP $base: main locale"
      ;;
    *)
      process_file "$f"
      ;;
  esac
done

echo "Done."
