#!/usr/bin/env python3
"""extend-calendar.py — Extends content-calendar.json with N more days via
Claude API, using diverse viral copy archetypes and rotating Dan's real
photo library + curated existing images.

Usage:
    ANTHROPIC_API_KEY=sk-ant-... python3 tools/browser-agent/scripts/extend-calendar.py --days 30

The script:
1. Loads the existing calendar
2. Finds the last scheduled date
3. Calls Claude to generate N new days starting from (last + 1)
4. Asks Claude for: text (180-600 chars), one of 12 archetypes, suggested image category
5. Maps each entry to a photo from the rotation pool
6. Merges into the calendar
7. Writes back, preserving past entries

Why this exists: the buffer agent's "most-recent past entry" fallback
silently re-served the same content for 6+ days when the calendar ran
out. The watchdog catches it, this script fixes it.
"""
import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent.parent
CALENDAR_PATH = ROOT / "tools" / "browser-agent" / "data" / "content-calendar.json"
REAL_PHOTOS_DIR = ROOT / "app" / "frontend" / "public" / "social" / "real"

ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not ANTHROPIC_KEY:
    print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr); sys.exit(1)

# ── Photo pool ────────────────────────────────────────────────────────────────
real_photos = sorted(REAL_PHOTOS_DIR.glob("*.jpg")) if REAL_PHOTOS_DIR.exists() else []
photo_pool = [f"https://thepropertydna.com/social/real/{p.name}" for p in real_photos]
existing_curated = ["2026-05-18.jpg", "2026-05-22.jpg", "2026-05-27.jpg", "2026-06-01.jpg", "2026-06-05.jpg"]
photo_pool.extend([f"https://thepropertydna.com/social/photo/{f}" for f in existing_curated])

SYSTEM_PROMPT = """You write viral social copy for PropertyDNA — a free property intelligence platform that defends homebuyers from asymmetric information. Mission: "save the humans."

Brand voice:
- Punchy. Confident. Slightly indignant on the buyer's behalf
- Never markety-speak. Plain language.
- Specific numbers > round numbers ("$28,000" beats "thousands of dollars")
- One CTA per post — always either "free DNA report on any address — link in bio" or "free iOS app — link in bio" or "DM us your address"

OUTPUT FORMAT: respond with ONLY valid JSON, no markdown fences. An array of N objects:
[
  {
    "archetype": "one_of_the_listed_archetypes",
    "text": "180-600 character post copy. Multi-line OK. Real numbers if possible. Always end with hashtags (#propertydna #realestate plus 2-4 context-specific).",
    "image_category": "homes-exterior" | "homes-interior" | "palm-springs-scenes" | "agents" | "any"
  },
  ...
]

NEVER repeat exactly the same archetype twice in a 5-day window. Vary tone (some serious, some playful). Vary length (some terse, some long). The 15 archetypes available are: pain_hook, real_number_reveal, founder_voice, skit_hook, listing_react, educational, mission_statement, florida_hot_take, methodology, off_market, save_story, comparison, behind_the_scenes, sunday_reflective, weekend_open.
"""

def call_claude(num_days: int, start_date: date) -> list[dict]:
    user_prompt = f"""Generate {num_days} viral social media posts for PropertyDNA, one per day starting {start_date.isoformat()}.

Vary archetype across days. Avoid same archetype within 5-day window. Mix real numbers ($28K saved, 14% comp spread, 3 unfinaled permits, etc.) with mission framing and pain hooks. Include 1-2 Florida-insurance posts in the batch (timely topic). Include 1-2 about the Coachella Valley (our home market). Include 1 founder-voice and 1 sunday-reflective if a Sunday falls in the range.

Respond ONLY with the JSON array of {num_days} objects."""

    body = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": 8192,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.load(resp)
    text = data["content"][0]["text"].strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"```\s*$", "", text)
    return json.loads(text)


def pick_image(category: str, index: int) -> str:
    matching = [p for p in photo_pool if f"/{category}-" in p] if category != "any" else []
    if matching:
        return matching[index % len(matching)]
    return photo_pool[index % len(photo_pool)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args()

    with open(CALENDAR_PATH) as f:
        cal = json.load(f)

    posts = cal.get("posts", [])
    last_date = max((p["date"] for p in posts), default=date.today().isoformat())
    start = datetime.fromisoformat(last_date).date() + timedelta(days=1)

    print(f"Last calendar date: {last_date}")
    print(f"Generating {args.days} new days starting {start.isoformat()}…")
    print(f"Photo pool: {len(photo_pool)} images")

    drafts = call_claude(args.days, start)
    if not isinstance(drafts, list) or len(drafts) != args.days:
        print(f"WARNING: expected {args.days} items, got {len(drafts) if isinstance(drafts, list) else 'not a list'}", file=sys.stderr)

    new_entries = []
    for i, draft in enumerate(drafts):
        d = start + timedelta(days=i)
        img = pick_image(draft.get("image_category", "any"), i)
        new_entries.append({
            "date": d.isoformat(),
            "text": draft["text"],
            "reddit": None,
            "medium": None,
            "pattern": draft.get("archetype", "general"),
            "image": img,
        })

    cal["posts"] = posts + new_entries
    cal["generated"] = f"{date.today().isoformat()} (extended +{len(new_entries)} days via extend-calendar.py)"

    with open(CALENDAR_PATH, "w") as f:
        json.dump(cal, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Added {len(new_entries)} entries. Calendar now goes to {new_entries[-1]['date']}.")


if __name__ == "__main__":
    main()
