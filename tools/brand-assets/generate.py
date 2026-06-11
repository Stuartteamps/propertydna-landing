#!/usr/bin/env python3
"""
PropertyDNA brand asset generator.

Produces a full set of social-platform-sized banners + profile photos using
Pillow. Brand palette: #0A0908 (background) + #C9A84C (gold accent) + #F4F0E8
(off-white text). Serif: Georgia (Cormorant Garamond stand-in). Sans:
Helvetica Neue (Jost stand-in).

Run:
    python3 generate.py

Outputs PNGs to ./out/
"""
import os
from PIL import Image, ImageDraw, ImageFont

# ── Palette ────────────────────────────────────────────────────────────────
BG       = (10, 9, 8, 255)         # #0A0908
GOLD     = (201, 168, 76, 255)     # #C9A84C
GOLD_DIM = (201, 168, 76, 180)
CANVAS   = (244, 240, 232, 255)    # #F4F0E8
MUTED    = (244, 240, 232, 140)

# ── Fonts ──────────────────────────────────────────────────────────────────
FONT_SERIF        = "/System/Library/Fonts/Supplemental/Georgia.ttf"
FONT_SERIF_ITALIC = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"
FONT_SERIF_BOLD   = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
FONT_SANS         = "/System/Library/Fonts/Helvetica.ttc"
FONT_SANS_BOLD    = "/System/Library/Fonts/HelveticaNeue.ttc"

def f(path, size, index=0):
    try:
        return ImageFont.truetype(path, size, index=index) if path.endswith(".ttc") else ImageFont.truetype(path, size)
    except Exception as e:
        print(f"  font fallback for {path}: {e}")
        return ImageFont.load_default()

# ── Cross-hatch glyph (the PropertyDNA mark) ──────────────────────────────
def draw_glyph(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int,
               color=GOLD, stroke=None):
    """Draw the cross-hatch square mark centered at (cx, cy) with given outer size."""
    if stroke is None:
        stroke = max(2, size // 32)
    half = size // 2
    x0, y0, x1, y1 = cx - half, cy - half, cx + half, cy + half
    # Outer rectangle
    draw.rectangle([x0, y0, x1, y1], outline=color, width=stroke)
    # Cross-hatch lines (vertical + horizontal through center)
    line_w = max(1, stroke // 2)
    draw.line([(cx, y0), (cx, y1)], fill=color, width=line_w)
    draw.line([(x0, cy), (x1, cy)], fill=color, width=line_w)

def text_size(font, text):
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

# ── Asset definitions ─────────────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT_DIR, exist_ok=True)

def make_profile(size=1080, name="profile.png"):
    """Square profile photo: gold cross-hatch mark on dark background."""
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)
    # Glyph: ~52% of frame, stroke proportional
    glyph_size = int(size * 0.52)
    draw_glyph(d, size // 2, size // 2, glyph_size, color=GOLD,
               stroke=max(4, size // 90))
    out = os.path.join(OUT_DIR, name)
    img.save(out, "PNG", optimize=True)
    print(f"  ✓ {name}  ({size}x{size})")
    return out

def make_banner(width, height, name,
                headline="The data your real estate agent doesn't want you to see.",
                sub="Free for buyers, forever · thepropertydna.com",
                logo_position="bottom-right",
                glyph_position="left",
                headline_max_width_ratio=0.65):
    """Generic dark banner with serif headline + gold sub + corner glyph + wordmark."""
    img = Image.new("RGBA", (width, height), BG)
    d = ImageDraw.Draw(img)

    # Subtle radial gradient (gold tint in upper-right via overlay)
    gradient = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(gradient)
    for r in range(0, max(width, height), max(2, height // 60)):
        alpha = max(0, 40 - (r * 40 // (max(width, height) // 2)))
        if alpha <= 0: break
        g_draw.ellipse(
            [int(width * 0.7) - r, int(height * 0.3) - r,
             int(width * 0.7) + r, int(height * 0.3) + r],
            outline=(201, 168, 76, alpha),
            width=1,
        )
    img = Image.alpha_composite(img, gradient)
    d = ImageDraw.Draw(img)

    # Layout — content panel inset from edges
    pad_x = int(width * 0.06)
    pad_y = int(height * 0.18)

    # Pick font sizes proportional to banner height
    headline_size = max(18, int(height * 0.13))
    sub_size      = max(14, int(height * 0.055))
    mark_size     = max(20, int(height * 0.10))

    serif       = f(FONT_SERIF, headline_size)
    serif_ital  = f(FONT_SERIF_ITALIC, headline_size)
    sans        = f(FONT_SANS, sub_size, index=4)  # 4 = Helvetica-Bold
    mark_font   = f(FONT_SANS_BOLD, mark_size, index=0)

    # Wrap headline if it exceeds max width
    max_w = int(width * headline_max_width_ratio)
    words = headline.split()
    lines = []
    cur = ""
    for w in words:
        test = (cur + " " + w).strip()
        tw, _ = text_size(serif, test)
        if tw > max_w and cur:
            lines.append(cur)
            cur = w
        else:
            cur = test
    if cur:
        lines.append(cur)

    # Draw headline
    line_h = int(headline_size * 1.15)
    text_block_h = line_h * len(lines)
    sub_h = int(sub_size * 1.4)
    total_h = text_block_h + 8 + sub_h
    start_y = (height - total_h) // 2

    for i, line in enumerate(lines):
        d.text((pad_x, start_y + i * line_h), line, font=serif, fill=CANVAS)

    # Sub
    d.text((pad_x, start_y + text_block_h + 8), sub, font=sans, fill=GOLD_DIM)

    # Glyph on left or right edge
    glyph_size = int(height * 0.42)
    if glyph_position == "right":
        gx = width - pad_x - glyph_size // 2
    else:
        gx = width - pad_x - glyph_size // 2  # banners look better with glyph right
    gy = height // 2
    draw_glyph(d, gx, gy, glyph_size, color=GOLD, stroke=max(3, height // 100))

    # Tiny "PROPERTYDNA" wordmark in opposite corner
    wm_size = max(10, int(height * 0.035))
    wm_font = f(FONT_SANS_BOLD, wm_size, index=4)
    if logo_position == "bottom-right":
        wx = width - pad_x
        wy = height - pad_y // 2
        tw, th = text_size(wm_font, "PROPERTYDNA")
        d.text((wx - tw, wy - th), "PROPERTYDNA", font=wm_font, fill=GOLD_DIM)

    out = os.path.join(OUT_DIR, name)
    img.save(out, "PNG", optimize=True)
    print(f"  ✓ {name}  ({width}x{height})")
    return out

# ── Render the full set ───────────────────────────────────────────────────
print("PropertyDNA brand assets — generating…\n")
print("Profile photos:")
make_profile(1080, "profile-1080.png")
make_profile(400,  "profile-400.png")
make_profile(320,  "profile-320.png")

print("\nBanners:")
# X / Twitter
make_banner(1500, 500, "x-banner.png")
# LinkedIn personal
make_banner(1584, 396, "linkedin-personal-banner.png",
            headline="Defending homebuyers from data asymmetry.",
            sub="3.58M parcels · Free for buyers, forever · thepropertydna.com")
# LinkedIn company
make_banner(1128, 191, "linkedin-company-banner.png",
            headline="Free property intelligence for the rest of us.",
            sub="3.58M parcels · thepropertydna.com")
# YouTube channel banner — full size with safe zone respected (text in middle 1546x423)
make_banner(2560, 1440, "youtube-banner.png",
            headline="The data your real estate agent doesn't want you to see.",
            sub="Free reports on any address · Save the humans",
            headline_max_width_ratio=0.55)
# Facebook cover
make_banner(1640, 856, "facebook-cover.png",
            headline="Free property intelligence. Forever.",
            sub="3.58M parcels indexed · thepropertydna.com")
# Pinterest cover
make_banner(800, 450, "pinterest-cover.png",
            headline="Pre-sign property intelligence, free.",
            sub="thepropertydna.com")
# Bluesky banner (3x ratio is the common cover size)
make_banner(3000, 1000, "bluesky-banner.png",
            headline="The data your real estate agent doesn't want you to see.",
            sub="Free for buyers, forever · thepropertydna.com")
# Instagram avatar-sized exports — re-use profile but tagged for clarity
make_profile(320, "instagram-avatar.png")
make_profile(200, "tiktok-avatar.png")

print(f"\nDone. {len(os.listdir(OUT_DIR))} files in {OUT_DIR}")
