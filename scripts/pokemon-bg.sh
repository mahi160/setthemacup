#!/usr/bin/env bash

POKEMON_DIR="${HOME}/Pictures/pokemon_bg"
GHOSTTY_CONFIG="${HOME}/.config/ghostty/config"
MAX_POKEMON=1025

mkdir -p "$POKEMON_DIR"

# Pick a specific ID if passed as arg, otherwise random
if [[ -n "${1:-}" ]]; then
  POKEMON_ID="$1"
else
  POKEMON_ID=$(( RANDOM % MAX_POKEMON + 1 ))
fi

IMAGE_PATH="${POKEMON_DIR}/${POKEMON_ID}.png"

# Download official artwork if not cached
if [[ ! -f "$IMAGE_PATH" ]]; then
  printf "Fetching Pokemon #%d...\n" "$POKEMON_ID"
  curl -sL --fail \
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${POKEMON_ID}.png" \
    -o "$IMAGE_PATH" \
    || { printf "Failed to download Pokemon #%d\n" "$POKEMON_ID" >&2; rm -f "$IMAGE_PATH"; exit 1; }
  # Resize to 300x300 so it stays compact as a corner watermark
  sips -z 1000 1000 "$IMAGE_PATH" --out "$IMAGE_PATH" >/dev/null 2>&1
fi

# Update background-image in Ghostty config (handles commented and uncommented)
if grep -qE "^#?[[:space:]]*background-image[[:space:]]*=" "$GHOSTTY_CONFIG"; then
  sed -i '' -E "s|^#?[[:space:]]*background-image[[:space:]]*=.*|background-image = ${IMAGE_PATH}|" "$GHOSTTY_CONFIG"
else
  printf "\nbackground-image = %s\n" "$IMAGE_PATH" >> "$GHOSTTY_CONFIG"
fi

printf "Pokemon #%d\n" "$POKEMON_ID"
