#!/usr/bin/env python3
"""
Pushes skip-traced CSVs directly to Supabase and triggers email blasts.

Usage:
    python3 tools/push_campaigns.py                  # push + email all enriched CSVs
    python3 tools/push_campaigns.py --push-only       # push to Supabase, don't send emails
    python3 tools/push_campaigns.py --email-id <id>   # send emails for an existing campaign ID

Reads from: tools/gmail-cleanup/contacts/skip_trace_results/
Writes to:  Supabase campaigns + campaign_contacts (direct REST, bypasses Netlify function)
Emails via: https://thepropertydna.com/.netlify/functions/send-campaign-emails
"""

import csv
import json
import os
import sys
import time
from pathlib import Path

import requests

INTERNAL_KEY = os.environ.get(
    "INTERNAL_API_KEY",
    "271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977",
)
SUPA_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPA_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT",
)
BASE = "https://thepropertydna.com/.netlify/functions"
RESULTS_DIR = (
    Path(__file__).parent / "gmail-cleanup" / "contacts" / "skip_trace_results"
)

SUPA_HEADERS = {
    "apikey": SUPA_KEY,
    "Authorization": f"Bearer {SUPA_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}
EMAIL_HEADERS = {
    "Content-Type": "application/json",
    "x-internal-key": INTERNAL_KEY,
}

CITY_SCORES = {
    "palm springs": (74, "Strong Buy"),
    "palm desert":  (71, "Buy"),
    "rancho mirage": (76, "Strong Buy"),
    "indian wells": (78, "Strong Buy"),
    "la quinta":    (73, "Buy"),
    "indio":        (65, "Buy"),
    "cathedral city": (62, "Hold"),
    "desert hot springs": (58, "Hold"),
    "coachella":    (60, "Hold"),
    "el cajon":     (58, "Hold"),
    "los angeles":  (69, "Buy"),
    "san diego":    (72, "Buy"),
}
ZIP_CITY = {
    "92262": "palm springs", "92263": "palm springs", "92264": "palm springs",
    "92260": "palm desert",  "92270": "rancho mirage", "92210": "indian wells",
    "92253": "la quinta",    "92201": "indio",          "92203": "indio",
    "92020": "el cajon",     "92021": "el cajon",       "92019": "el cajon",
}

CAMPAIGN_NAMES = {
    "needs_skiptracing_el_cajon_2026-05-01":              "El Cajon — Distressed & Foreclosure (Skip-Traced)",
    "needs_skiptracing_movie_colony_absentee_2026-05-01": "Movie Colony — Absentee Owners (Skip-Traced)",
    "needs_skiptracing_movie_colony_occupied_2026-05-01": "Movie Colony — Owner Occupied (Skip-Traced)",
    "needs_skiptracing_oasis_palmdesert_2026-05-01":      "Oasis Palm Desert — Homeowners (Skip-Traced)",
    "needs_skiptracing_ps_commercial_2026-05-01":         "Palm Springs — Commercial & Hotel Owners (Skip-Traced)",
    "needs_skiptracing_ps_homes_2026-05-01":              "Palm Springs — Homes (Skip-Traced)",
    "needs_skiptracing_ps_multifamily_2026-05-01":        "Palm Springs — Multifamily Owners (Skip-Traced)",
    "needs_skiptracing_quincy_farm_2026-05-01":           "Quincy Way Farm — Homeowners (Skip-Traced)",
}

SUBJECT_TEMPLATES = {
    "palm springs": "Your Palm Springs Property Ranked {score}/100 by PropertyDNA",
    "palm desert":  "Your Palm Desert Property Ranked {score}/100 by PropertyDNA",
    "el cajon":     "Your El Cajon Property Ranked {score}/100 by PropertyDNA",
    "movie colony": "Your Movie Colony Property Ranked {score}/100 by PropertyDNA",
    "oasis":        "Your Palm Desert Property Ranked {score}/100 by PropertyDNA",
}
DEFAULT_SUBJECT = "Your Property Ranked by PropertyDNA — See Your Score"


def enrich(city, zip_code):
    c = (city or ZIP_CITY.get(zip_code, "")).lower().strip()
    score, label = CITY_SCORES.get(c, (63, "Hold"))
    return score, label, c


def guess_subject(contacts):
    cities = [c.get("city", "").lower() for c in contacts if c.get("city")]
    most_common = max(set(cities), key=cities.count) if cities else ""
    for key, tmpl in SUBJECT_TEMPLATES.items():
        if key in most_common:
            score, _, _ = enrich(most_common, "")
            return tmpl.format(score=score)
    return DEFAULT_SUBJECT


def create_campaign_direct(name, contacts, subject):
    """Insert campaign + contacts directly into Supabase REST (bypasses Netlify function)."""
    # Create campaign row
    payload = {
        "name": name,
        "type": "homeowner",
        "status": "draft",
        "subject": subject,
        "template": "agent",
        "total_contacts": len(contacts),
    }
    resp = requests.post(f"{SUPA_URL}/rest/v1/campaigns", headers=SUPA_HEADERS, json=payload, timeout=30)
    if resp.status_code not in (200, 201):
        print(f"  ERROR creating campaign: {resp.status_code} {resp.text[:300]}")
        return None

    campaign = resp.json()
    campaign_id = campaign[0]["id"] if isinstance(campaign, list) else campaign.get("id")
    if not campaign_id:
        print(f"  ERROR: no campaign id in response: {campaign}")
        return None

    # Pull unsubscribes to filter
    unsub_resp = requests.get(
        f"{SUPA_URL}/rest/v1/campaign_unsubscribes?select=email",
        headers=SUPA_HEADERS, timeout=30
    )
    unsub_emails = set()
    if unsub_resp.status_code == 200:
        unsub_emails = {r["email"].lower() for r in unsub_resp.json() if r.get("email")}

    # Build contact rows
    rows = []
    for c in contacts:
        email = (c.get("email") or "").lower().strip()
        if not email or "@" not in email or email in unsub_emails:
            continue
        city = c.get("city", "")
        score, label, city_norm = enrich(city, c.get("zip", ""))
        rows.append({
            "campaign_id": campaign_id,
            "first_name": c.get("firstName") or c.get("first_name", ""),
            "last_name":  c.get("lastName")  or c.get("last_name", ""),
            "email":      email,
            "phone":      c.get("phone", ""),
            "address":    c.get("address", ""),
            "city":       city or city_norm,
            "state":      c.get("state", "CA"),
            "zip":        c.get("zip", ""),
            "neighborhood_score": score,
            "score_label": label,
            "status": "pending",
        })

    if not rows:
        print(f"  All contacts filtered (bounced/unsubscribed)")
        return campaign_id, 0, len(contacts)

    # Bulk insert in batches of 500
    inserted = 0
    BATCH = 500
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        r = requests.post(
            f"{SUPA_URL}/rest/v1/campaign_contacts",
            headers=SUPA_HEADERS, json=batch, timeout=60
        )
        if r.status_code not in (200, 201):
            print(f"  ERROR inserting contacts batch {i//BATCH+1}: {r.status_code} {r.text[:200]}")
        else:
            inserted += len(batch)

    # Update final contact count
    requests.patch(
        f"{SUPA_URL}/rest/v1/campaigns?id=eq.{campaign_id}",
        headers=SUPA_HEADERS,
        json={"total_contacts": inserted},
        timeout=15,
    )

    return campaign_id, inserted, len(contacts) - inserted


def send_emails(campaign_id, name):
    sent = 0
    batches = 0
    while True:
        resp = requests.post(
            f"{BASE}/send-campaign-emails",
            headers=EMAIL_HEADERS,
            json={"campaignId": campaign_id},
            timeout=60,
        )
        if resp.status_code != 200:
            print(f"  Send error batch {batches+1}: {resp.status_code} {resp.text[:200]}")
            break
        data = resp.json()
        batch_sent = data.get("sent", 0)
        sent += batch_sent
        batches += 1
        print(f"  [{name}] batch {batches}: +{batch_sent} sent (total {sent})")
        if data.get("done"):
            break
        time.sleep(2)
    return sent


def read_csv(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def main():
    args = sys.argv[1:]
    push_only = "--push-only" in args
    send_existing = "--email-id" in args

    if send_existing:
        idx = args.index("--email-id")
        campaign_id = args[idx + 1]
        print(f"Sending emails for campaign {campaign_id}...")
        total = send_emails(campaign_id, campaign_id)
        print(f"Done. {total} emails sent.")
        return

    csv_files = sorted(RESULTS_DIR.glob("needs_skiptracing_*.csv"))
    if not csv_files:
        print(f"No enriched CSVs found in {RESULTS_DIR}")
        sys.exit(1)

    print(f"Found {len(csv_files)} enriched CSVs.\n")

    total_pushed = 0
    total_sent = 0
    campaign_ids = []

    for csv_path in csv_files:
        stem = csv_path.stem
        name = CAMPAIGN_NAMES.get(stem, stem)
        records = read_csv(csv_path)
        contacts = [r for r in records if r.get("email")]

        if not contacts:
            print(f"Skipping {name} — no email contacts\n")
            continue

        subject = guess_subject(contacts)
        print(f"Creating: {name}")
        print(f"  {len(contacts)} contacts with email | subject: {subject}")

        result = create_campaign_direct(name, contacts, subject)
        if not result:
            continue

        campaign_id, inserted, skipped = result
        total_pushed += inserted
        campaign_ids.append((campaign_id, name))
        print(f"  Campaign {campaign_id} — {inserted} contacts inserted, {skipped} skipped/filtered\n")

    if push_only:
        print("=" * 60)
        print(f"PUSH DONE: {total_pushed} contacts across {len(campaign_ids)} campaigns")
        print("Campaign IDs:")
        for cid, cname in campaign_ids:
            print(f"  {cid}  {cname}")
        print("\nTo send emails: python3 tools/push_campaigns.py --email-id <id>")
        return

    print("Sending emails...\n")
    for campaign_id, name in campaign_ids:
        print(f"Sending: {name}")
        sent = send_emails(campaign_id, name)
        total_sent += sent
        print(f"  {sent} emails sent\n")

    print("=" * 60)
    print(f"DONE: {total_pushed} contacts pushed | {total_sent} emails sent")
    print("\nMonitor at: https://thepropertydna.com/admin/campaigns")


if __name__ == "__main__":
    main()
