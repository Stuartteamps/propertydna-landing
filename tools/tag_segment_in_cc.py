#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tag a segment in Constant Contact by creating a list + importing contacts.

Usage:
  python3 tools/tag_segment_in_cc.py <segment.csv> "List Name" [--list-id <existing-id>]

Looks up CC access token from Supabase oauth_tokens table.
"""
import sys, json, csv, requests, urllib.parse, os

if len(sys.argv) < 3:
    print(__doc__); sys.exit(1)

CSV_PATH  = sys.argv[1]
LIST_NAME = sys.argv[2]
EXISTING_LIST_ID = None
if '--list-id' in sys.argv:
    EXISTING_LIST_ID = sys.argv[sys.argv.index('--list-id') + 1]

SUPA_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPA_KEY = "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT"
SH = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}

# ── 1. Get CC token from Supabase ────────────────────────────────────────────
print("Fetching CC token...")
r = requests.get(f"{SUPA_URL}/rest/v1/oauth_tokens",
                params={"select": "access_token,expires_at", "provider": "eq.constant_contact", "limit": 1},
                headers=SH, timeout=15)
tok_rows = r.json()
if not tok_rows or not tok_rows[0].get('access_token'):
    print("ERROR: no CC token in oauth_tokens table"); sys.exit(1)
CC_TOKEN = tok_rows[0]['access_token']
print(f"  token: ...{CC_TOKEN[-8:]} | expires {tok_rows[0]['expires_at']}")

CC_HEADERS = {"Authorization": f"Bearer {CC_TOKEN}", "Content-Type": "application/json", "Accept": "application/json"}
CC_BASE = "https://api.cc.email/v3"

# ── 2. Create new list (or use existing) ────────────────────────────────────
if EXISTING_LIST_ID:
    list_id = EXISTING_LIST_ID
    print(f"Using existing list_id: {list_id}")
else:
    print(f"Creating CC list: '{LIST_NAME}'")
    r = requests.post(f"{CC_BASE}/contact_lists", headers=CC_HEADERS,
                     json={"name": LIST_NAME, "description": f"PropertyDNA segment: {LIST_NAME}", "favorite": False},
                     timeout=15)
    if r.status_code not in (200, 201):
        print(f"ERROR creating list: {r.status_code} {r.text[:300]}"); sys.exit(1)
    list_id = r.json().get('list_id')
    print(f"  list_id: {list_id}")

# ── 3. Read segment + format for CC import ──────────────────────────────────
rows = list(csv.DictReader(open(CSV_PATH)))
print(f"Loading {len(rows)} contacts from {CSV_PATH}")

# CC json_import format
cc_contacts = []
for r_row in rows:
    email = (r_row.get('email') or '').strip().lower()
    if not email or '@' not in email: continue
    cc_contacts.append({
        "email": email,
        "first_name": (r_row.get('first_name') or '').strip().title(),
        "last_name":  (r_row.get('last_name')  or '').strip().title(),
        "phone": (r_row.get('phone') or '').strip(),
        "street": r_row.get('address',''),
        "city":   r_row.get('city',''),
        "state":  r_row.get('state',''),
        "zip":    r_row.get('zip',''),
    })

print(f"  formatted: {len(cc_contacts)} valid emails")

# ── 4. Bulk import to CC with list_id ───────────────────────────────────────
import_body = {
    "import_data": cc_contacts,
    "list_ids": [list_id],
}
r = requests.post(f"{CC_BASE}/activities/contacts_json_import",
                 headers=CC_HEADERS, json=import_body, timeout=60)
if r.status_code not in (200, 201, 202):
    print(f"ERROR bulk import: {r.status_code} {r.text[:300]}"); sys.exit(1)
result = r.json()
print(f"\nImport queued: activity_id={result.get('activity_id') or result.get('id')}")
print(f"  status: {result.get('status', '?')}")
print(f"\nDONE: {len(cc_contacts)} contacts tagged in CC list '{LIST_NAME}' ({list_id})")
