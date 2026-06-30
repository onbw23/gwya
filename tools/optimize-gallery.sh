#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-gallery}"
OUTPUT_DIR="${2:-assets/gallery}"
MAX_SIZE="${MAX_SIZE:-1600}"
QUALITY="${QUALITY:-82}"

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp is required. Install it with: brew install webp" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

index=1
find "$SOURCE_DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | sort | while IFS= read -r source; do
  output="$OUTPUT_DIR/$(printf '%02d' "$index").webp"
  width="$(sips -g pixelWidth "$source" | awk '/pixelWidth/ { print $2 }')"
  height="$(sips -g pixelHeight "$source" | awk '/pixelHeight/ { print $2 }')"

  if [ "$width" -ge "$height" ]; then
    cwebp -quiet -q "$QUALITY" -resize "$MAX_SIZE" 0 "$source" -o "$output"
  else
    cwebp -quiet -q "$QUALITY" -resize 0 "$MAX_SIZE" "$source" -o "$output"
  fi

  printf '%s -> %s\n' "$source" "$output"
  index=$((index + 1))
done
