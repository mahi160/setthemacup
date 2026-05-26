#!/bin/bash

# Base path for notes
NOTES_PATH="$HOME/Documents/Notes/Mindflayer/QuickNotes"
mkdir -p "$NOTES_PATH"

# Get current date components
YEAR=$(date +"%Y")
MONTH=$(date +"%B")   # September, October, etc
DAY=$(date +"%d")     # 01-31
WEEKDAY=$(date +"%A") # Monday, Tuesday, etc
TIME=$(date +"%H:%M")

# Define the yearly file
JOURNAL_FILE="$NOTES_PATH/$YEAR.md"

# Get the note text
NOTE_TEXT="$@"

# Exit if note is empty
if [ -z "$NOTE_TEXT" ]; then
  exit 0
fi

# Create yearly file if it doesn't exist
# if [ ! -f "$JOURNAL_FILE" ]; then
#   echo "# $YEAR" >"$JOURNAL_FILE"
# fi

# Create month header if it doesn't exist
if ! grep -q "^## $MONTH" "$JOURNAL_FILE" 2>/dev/null; then
  echo -e "## $MONTH" >>"$JOURNAL_FILE"
fi

# Create daily header if it doesn't exist
if ! grep -q "^### $DAY $WEEKDAY" "$JOURNAL_FILE" 2>/dev/null; then
  echo -e "\n### $DAY $WEEKDAY" >>"$JOURNAL_FILE"
fi

# Format entry with checkbox
export ENTRY="- [ ] [$TIME] $NOTE_TEXT"

# Append the entry under today's section - macOS compatible version
awk -v date_pattern="^### $DAY $WEEKDAY" '
    BEGIN { entry = ENVIRON["ENTRY"] }
    $0 ~ date_pattern {
        print
        print entry
        next_section = 1
        next
    }
    /^###/ {
        if (next_section) {
            print ""
        }
        next_section = 0
    }
    { print }
' "$JOURNAL_FILE" >"$JOURNAL_FILE.tmp" && mv "$JOURNAL_FILE.tmp" "$JOURNAL_FILE"
