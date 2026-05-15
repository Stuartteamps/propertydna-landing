#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wave 2: send to ALL remaining net-new IW+RM absentee owners with email.
Excludes the 150 already emailed today (Tier 1 = 5+yr & score 40+).

Tier 2:  87 net-new 10+yr owners (premium tenure)
Tier 3:  360 net-new any-tenure with email (broader)
"""
import csv, json, requests, time, sys

SUPA_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPA_KEY = "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT"
INTERNAL = "271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977"
NETLIFY = "https://thepropertydna.com/.netlify/functions"
SH = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
      "Content-Type": "application/json", "Prefer": "return=representation"}

def email_of(r):
    for k in ['email_1','email_2','email_3']:
        e=(r.get(k) or '').strip()
        if e and '@' in e and not e.startswith('NO_'): return e
    return None
def yrs(r):
    try: return int(float(str(r.get('years_owned') or 0).split('.')[0]))
    except: return 0
def score(r):
    try: return int(r.get('sell_propensity_score') or 0)
    except: return 0
def value_of(r):
    try: return int(float(str(r.get('estimated_value') or 0).split('.')[0]))
    except: return 0

# Load enriched data
rows = list(csv.DictReader(open('tools/gmail-cleanup/contacts/skip_trace_results/lead_builder_iw_rm_high_equity_absentee_2026-05-08.csv')))

# Tier 1 (already sent today): 5+yr AND score 40+
already_sent = set()
for r in rows:
    e = email_of(r)
    if e and yrs(r) >= 5 and score(r) >= 40:
        already_sent.add(e.lower())

# Build wave-2 list: everything with email NOT in tier 1, dedupe by email
wave2 = []
seen = set()
for r in rows:
    e = email_of(r)
    if not e: continue
    e_lc = e.lower()
    if e_lc in already_sent or e_lc in seen: continue
    seen.add(e_lc)
    wave2.append({
        'first_name': (r.get('owner_1_first_name') or '').strip().title(),
        'last_name':  (r.get('owner_1_last_name') or '').strip().title(),
        'email':      e_lc,
        'phone':      (r.get('primary_phone') or '').strip(),
        'address':    r.get('address',''),
        'city':       r.get('city',''),
        'state':      r.get('state',''),
        'zip':        r.get('zip_code',''),
        'years_owned': yrs(r),
        'estimated_value': value_of(r),
        'sell_score':  score(r),
        'tier': 2 if yrs(r) >= 10 else 3,
    })

# Sort: 10+yr first, then by sell propensity, then by value
wave2.sort(key=lambda x: (-(x['years_owned'] >= 10), -x['sell_score'], -x['estimated_value']))

t2 = sum(1 for w in wave2 if w['tier'] == 2)
t3 = sum(1 for w in wave2 if w['tier'] == 3)
print(f"Wave 2 build: {len(wave2)} unique contacts | Tier 2 (10+yr): {t2} | Tier 3 (5-9yr/any): {t3}")

# Save for record
import os
os.makedirs('tools/gmail-cleanup/contacts/segments', exist_ok=True)
with open('tools/gmail-cleanup/contacts/segments/cv_absentee_wave2.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(wave2[0].keys()))
    w.writeheader(); w.writerows(wave2)
print(f"saved -> tools/gmail-cleanup/contacts/segments/cv_absentee_wave2.csv")

# Create campaign in Supabase
camp = requests.post(f"{SUPA_URL}/rest/v1/campaigns", headers=SH, json={
    "name": "CV Absentee Wave 2 — IW+RM Net-New (Q2 2026)",
    "type": "homeowner", "status": "draft",
    "subject": "Your Coachella Valley property — PropertyDNA tracking update",
    "template": "absentee_seller_wave2",
    "total_contacts": len(wave2),
}, timeout=15).json()
campaign_id = camp[0]['id'] if isinstance(camp, list) else camp.get('id')
print(f"Campaign ID: {campaign_id}")

# Get unsubscribes
unsubs = requests.get(f"{SUPA_URL}/rest/v1/campaign_unsubscribes?select=email", headers=SH, timeout=15).json()
unsub_set = {u['email'].lower() for u in unsubs if u.get('email')}

# Build campaign_contacts rows
def city_score(c):
    return {'indian wells': 78, 'rancho mirage': 76, 'palm springs': 74, 'palm desert': 71, 'la quinta': 73}.get((c or '').lower().strip(), 70)
def city_label(s): return 'Strong Buy' if s >= 74 else 'Buy'

cc_rows = []
for w in wave2:
    if w['email'] in unsub_set: continue
    s = city_score(w['city'])
    cc_rows.append({
        'campaign_id': campaign_id,
        'first_name': w['first_name'], 'last_name': w['last_name'],
        'email': w['email'], 'phone': w['phone'],
        'address': w['address'], 'city': w['city'], 'state': w['state'], 'zip': w['zip'],
        'neighborhood_score': s, 'score_label': city_label(s),
        'status': 'pending',
    })
print(f"After unsub filter: {len(cc_rows)} to insert")

# Bulk insert in batches of 200
for i in range(0, len(cc_rows), 200):
    batch = cc_rows[i:i+200]
    requests.post(f"{SUPA_URL}/rest/v1/campaign_contacts", headers=SH, json=batch, timeout=30)
    print(f"  inserted batch {i//200+1}: {len(batch)}")

# Update count
requests.patch(f"{SUPA_URL}/rest/v1/campaigns?id=eq.{campaign_id}",
              headers=SH, json={"total_contacts": len(cc_rows)}, timeout=15)

# Send via Resend with force_send
EH = {"Content-Type": "application/json", "x-internal-key": INTERNAL}
total = batches = 0
print("\nSending...")
while True:
    r = requests.post(f"{NETLIFY}/send-campaign-emails", headers=EH,
                     json={"campaignId": campaign_id, "force_send": True}, timeout=90)
    if r.status_code != 200:
        print(f"  err {r.status_code}: {r.text[:200]}"); break
    d = r.json()
    sent = d.get('sent', 0)
    total += sent
    batches += 1
    print(f"  batch {batches}: +{sent} sent | done={d.get('done')}")
    if d.get('done'): break
    time.sleep(2)

print(f"\nDONE: {total} emails sent | campaign {campaign_id}")

# Also push to CC as a tagged list
print("\nPushing to CC list...")
cc_contacts = [{
    'email': w['email'], 'first_name': w['first_name'], 'last_name': w['last_name'],
    'phone': w['phone'], 'address': w['address'], 'city': w['city'],
    'state': w['state'], 'zip': w['zip'],
} for w in wave2 if w['email'] not in unsub_set]
r = requests.post(f"{NETLIFY}/cc-import-list", headers=EH, json={
    "listName": "CV Absentee Wave 2 — IW+RM Net-New (Q2 2026)",
    "description": f"Wave 2: {len(cc_contacts)} net-new IW+RM absentees sorted by sell propensity (10+yr first).",
    "contacts": cc_contacts,
}, timeout=60)
print(f"CC import: HTTP {r.status_code}")
if r.status_code == 200:
    print(json.dumps(r.json(), indent=2)[:400])
