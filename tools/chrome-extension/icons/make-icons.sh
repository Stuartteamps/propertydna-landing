#!/bin/bash
# Generate brand icons in 4 sizes using ImageMagick (preferred) or fall back to
# rendering an SVG and using sips. Run once before Chrome Web Store submit.
set -e
SVG_TMP=$(mktemp -t pdna-icon.XXXXXX.svg)
cat > "$SVG_TMP" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="#0A0908"/>
  <rect x="22" y="22" width="84" height="84" fill="none" stroke="#C9A84C" stroke-width="3"/>
  <line x1="64" y1="22" x2="64" y2="106" stroke="#C9A84C" stroke-width="2"/>
  <line x1="22" y1="64" x2="106" y2="64" stroke="#C9A84C" stroke-width="2"/>
  <circle cx="64" cy="64" r="6" fill="#C9A84C"/>
</svg>
SVG

if command -v magick >/dev/null 2>&1; then
  for size in 16 32 48 128; do
    magick -background none -density 600 "$SVG_TMP" -resize ${size}x${size} icon-${size}.png
    echo "  generated icon-${size}.png via ImageMagick"
  done
elif command -v rsvg-convert >/dev/null 2>&1; then
  for size in 16 32 48 128; do
    rsvg-convert -w $size -h $size "$SVG_TMP" -o icon-${size}.png
    echo "  generated icon-${size}.png via rsvg-convert"
  done
else
  echo "ImageMagick (brew install imagemagick) or librsvg (brew install librsvg) required."
  echo "Quick alternative: open icon.svg in browser, screenshot 128x128, then:"
  echo "  sips -z 16 16   icon-128.png --out icon-16.png"
  echo "  sips -z 32 32   icon-128.png --out icon-32.png"
  echo "  sips -z 48 48   icon-128.png --out icon-48.png"
  exit 1
fi

cp "$SVG_TMP" icon.svg
rm "$SVG_TMP"
echo "✓ Done — 4 icons + icon.svg ready."
