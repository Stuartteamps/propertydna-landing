#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Launch the CV Absentee Seller campaign (Q2 2026).

Target: 150 high-conversion absentee owners in Indian Wells + Rancho Mirage
        with 5+ year ownership and sell propensity score >= 40.

Flow:
  1. Create campaign in Supabase
  2. Insert 150 contacts with tag cv_absentee_seller_q2_2026
  3. Trigger send-campaign-emails (Resend) in batches of 50
"""
import csv, json, requests, time, sys

SUPA_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPA_KEY = "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT"
INTERNAL_KEY = "271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977"
NETLIFY = "https://thepropertydna.com/.netlify/functions"

SH = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
      "Content-Type": "application/json", "Prefer": "return=representation"}

# Load segment
contacts = list(csv.DictReader(open('tools/gmail-cleanup/contacts/segments/cv_absentee_seller_q2.csv')))
print(f"Loading {len(contacts)} contacts")

# Subject + template — targeted to absentee owners
SUBJECT = "Your [CITY] property has been tracked by PropertyDNA — see what changed"
NAME = "CV Absentee Sellers — 5+ Year Owners (Q2 2026)"

# Create campaign
camp_payload = {
    "name": NAME,
    "type": "homeowner",
    "status": "draft",
    "subject": "Your Coachella Valley property — PropertyDNA tracking update",
    "template": "absentee_seller",
    "total_contacts": len(contacts),
}
r = requests.post(f"{SUPA_URL}/rest/v1/campaigns", headers=SH, json=camp_payload, timeout=30)
if r.status_code not in (200, 201):
    print(f"ERROR creating campaign: {r.status_code} {r.text[:200]}")
    sys.exit(1)
campaign = r.json()
campaign_id = campaign[0]["id"] if isinstance(campaign, list) else campaign["id"]
print(f"Campaign created: {campaign_id}")

# Pull unsubscribes
unsubs = requests.get(f"{SUPA_URL}/rest/v1/campaign_unsubscribes?select=email",
                     headers=SH, timeout=15).json()
unsub_set = {u['email'].lower() for u in unsubs if u.get('email')}

# Build rows
def norm_city(c):
    return {'indian wells': 74, 'rancho mirage': 76, 'palm springs': 74, 'palm desert': 71, 'la quinta': 73}.get((c or '').lower().strip(), 70)

rows = []
for c in contacts:
    email = c['email'].lower().strip()
    if email in unsub_set: continue
    score = norm_city(c['city'])
    label = 'Strong Buy' if score >= 74 else 'Buy'
    rows.append({
        'campaign_id': campaign_id,
        'first_name': c['first_name'],
        'last_name':  c['last_name'],
        'email':      email,
        'phone':      c['phone'],
        'address':    c['address'],
        'city':       c['city'],
        'state':      c['state'],
        'zip':        c['zip'],
        'neighborhood_score': score,
        'score_label': label,
        'status':     'pending',
    })

# Insert in batches of 100
for i in range(0, len(rows), 100):
    batch = rows[i:i+100]
    r = requests.post(f"{SUPA_URL}/rest/v1/campaign_contacts", headers=SH, json=batch, timeout=30)
    if r.status_code not in (200, 201):
        print(f"  insert batch {i//100+1} failed: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    print(f"  inserted batch {i//100+1}: {len(batch)} rows")

# Update final count
requests.patch(f"{SUPA_URL}/rest/v1/campaigns?id=eq.{campaign_id}",
              headers=SH, json={"total_contacts": len(rows)}, timeout=15)

print(f"\n{len(rows)} contacts inserted. Triggering send...\n")

# Trigger send via Netlify function (Resend backend)
EH = {"Content-Type": "application/json", "x-internal-key": INTERNAL_KEY}
total_sent = 0
batches = 0
while True:
    r = requests.post(f"{NETLIFY}/send-campaign-emails", headers=EH,
                     json={"campaignId": campaign_id}, timeout=60)
    if r.status_code != 200:
        print(f"  send error: {r.status_code} {r.text[:200]}")
        break
    d = r.json()
    sent = d.get('sent', 0)
    total_sent += sent
    batches += 1
    print(f"  batch {batches}: +{sent} sent (total {total_sent})")
    if d.get('done'): break
    time.sleep(2)

print(f"\nDONE. Campaign {campaign_id} | {total_sent} emails sent")
print(f"Monitor: https://thepropertydna.com/admin/campaigns")
