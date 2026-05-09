#!/usr/bin/env python3
"""
Polls Tracerfy queues until complete, downloads results, merges with
source CSVs, and auto-pushes contacts with emails to Supabase campaigns.

Usage:
    python3 tools/fetch_skiptrace_results.py
    python3 tools/fetch_skiptrace_results.py --queue-ids 85815,85816
"""

import csv, io, json, os, sys, time, requests
from datetime import date
from pathlib import Path

TKEY     = os.environ.get("TRACERFY_API_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjozMjQ2ODIyNzk2LCJpYXQiOjE3NzgwMjI3OTYsImp0aSI6Ijk0ZjMwMjFkMGFhNjQzYmM5OTRhZGIxYzRjY2Q2ZjE1IiwidXNlcl9pZCI6NzE4OH0.r35Njjld2cWPGm1rdpfIFWOvzkXeC3ATdaUeaoXQHK0")
BASE     = "https://tracerfy.com/v1/api"
SUPA_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPA_KEY = "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT"
NETLIFY  = "https://thepropertydna.com/.netlify/functions"
INT_KEY  = "271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977"
OUT_DIR  = Path("tools/gmail-cleanup/contacts/skip_trace_results")
HDRS     = {"Authorization": f"Bearer {TKEY}"}

# Queue IDs submitted 2026-05-08
DEFAULT_QUEUES = [
    (85815, "Indian Wells — Absentee Owners (Skip-Traced)"),
    (85816, "Rancho Mirage — Absentee Owners (Skip-Traced)"),
]

CITY_SCORES = {
    "palm springs": (74, "Strong Buy"), "palm desert": (71, "Buy"),
    "rancho mirage": (76, "Strong Buy"), "indian wells": (78, "Strong Buy"),
    "la quinta": (73, "Buy"), "cathedral city": (62, "Hold"),
    "desert hot springs": (58, "Hold"), "indio": (65, "Buy"), "coachella": (60, "Hold"),
}

def tracerfy_get(endpoint):
    r = requests.get(f"{BASE}/{endpoint}", headers=HDRS, timeout=30)
    r.raise_for_status()
    return r.json()

def poll_queue(queue_id, max_wait=600):
    """Poll until queue is complete. Returns queue object."""
    print(f"  Polling queue {queue_id}...")
    start = time.time()
    while time.time() - start < max_wait:
        q = tracerfy_get(f"queue/{queue_id}")
        if isinstance(q, list):
            # queue returns the result rows directly when done
            return q
        if isinstance(q, dict) and not q.get("pending", True):
            return q
        elapsed = int(time.time() - start)
        print(f"    [{elapsed}s] still processing...")
        time.sleep(15)
    print(f"  Timeout after {max_wait}s")
    return None

def download_csv(url):
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    return list(csv.DictReader(io.StringIO(r.text)))

def enrich(city):
    c = (city or "").lower().strip()
    return CITY_SCORES.get(c, (63, "Hold"))

def push_to_campaigns(contacts, campaign_name):
    """Insert contacts directly to Supabase and send emails."""
    if not contacts:
        print("  No contacts to push")
        return 0, 0

    # Create campaign
    city_name = contacts[0].get("city","").lower()
    score, label = enrich(city_name)
    subject = f"Your {contacts[0].get('city','').title()} Property Ranked {score}/100 by PropertyDNA"

    campaign_payload = {
        "name":           campaign_name,
        "type":           "homeowner",
        "status":         "draft",
        "subject":        subject,
        "template":       "agent",
        "total_contacts": len(contacts),
    }
    r = requests.post(f"{SUPA_URL}/rest/v1/campaigns",
        headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=representation"},
        json=campaign_payload, timeout=30)
    if r.status_code not in (200,201):
        print(f"  Campaign create failed: {r.status_code} {r.text[:100]}")
        return 0, 0

    campaign_id = r.json()[0]["id"]

    # Pull unsubscribes
    unsub_r = requests.get(f"{SUPA_URL}/rest/v1/campaign_unsubscribes?select=email",
        headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}, timeout=20)
    unsub = {x["email"].lower() for x in unsub_r.json() if x.get("email")} if unsub_r.ok else set()

    # Build contact rows
    rows = []
    for c in contacts:
        email = (c.get("email_1") or c.get("email","")).lower().strip()
        if not email or "@" not in email or email in unsub: continue
        city = c.get("city","") or c.get("mail_city","")
        s, lbl = enrich(city)
        rows.append({
            "campaign_id":       campaign_id,
            "first_name":        c.get("first_name",""),
            "last_name":         c.get("last_name",""),
            "email":             email,
            "phone":             c.get("primary_phone","") or c.get("mobile_1",""),
            "address":           c.get("address",""),
            "city":              city,
            "state":             c.get("state","CA"),
            "zip":               c.get("zip","") or c.get("mail_zip",""),
            "neighborhood_score": s,
            "score_label":       lbl,
            "status":            "pending",
        })

    if not rows:
        print("  All filtered (unsubscribed/no email)")
        return campaign_id, 0

    # Bulk insert
    inserted = 0
    for i in range(0, len(rows), 500):
        batch = rows[i:i+500]
        r2 = requests.post(f"{SUPA_URL}/rest/v1/campaign_contacts",
            headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
                     "Content-Type": "application/json", "Prefer": "return=representation"},
            json=batch, timeout=60)
        if r2.status_code in (200,201): inserted += len(batch)

    # Update count
    requests.patch(f"{SUPA_URL}/rest/v1/campaigns?id=eq.{campaign_id}",
        headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=representation"},
        json={"total_contacts": inserted}, timeout=15)

    print(f"  Campaign {campaign_id}: {inserted} contacts inserted")
    return campaign_id, inserted

def send_campaign_emails(campaign_id, name):
    sent = total = 0
    while True:
        r = requests.post(f"{NETLIFY}/send-campaign-emails",
            headers={"Content-Type":"application/json","x-internal-key":INT_KEY},
            json={"campaignId": campaign_id}, timeout=60)
        if not r.ok: break
        d = r.json()
        batch = d.get("sent",0)
        sent += batch; total += 1
        print(f"    Batch {total}: +{batch} (total {sent})")
        if d.get("done"): break
        time.sleep(2)
    return sent

def main():
    args = sys.argv[1:]
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if "--queue-ids" in args:
        idx = args.index("--queue-ids")
        queue_ids = [(int(q), f"Queue {q}") for q in args[idx+1].split(",")]
    else:
        queue_ids = DEFAULT_QUEUES

    today = date.today().strftime("%Y-%m-%d")
    grand_sent = 0

    for queue_id, campaign_name in queue_ids:
        print(f"\n{'='*55}")
        print(f"Queue {queue_id}: {campaign_name}")

        # Check queue status
        q_status = tracerfy_get(f"queues/")
        queue_info = next((q for q in q_status if q.get("id") == queue_id), None)

        if queue_info and queue_info.get("pending"):
            print(f"  Still processing — polling...")
            # Poll until done
            deadline = time.time() + 600
            while time.time() < deadline:
                q_list = tracerfy_get("queues/")
                q = next((x for x in q_list if x.get("id") == queue_id), None)
                if q and not q.get("pending"):
                    queue_info = q
                    break
                print(f"  Waiting...")
                time.sleep(20)

        if not queue_info:
            print(f"  Queue {queue_id} not found")
            continue

        if queue_info.get("pending"):
            print(f"  Still pending — try again in a few minutes")
            continue

        download_url = queue_info.get("download_url")
        rows_uploaded = queue_info.get("rows_uploaded", 0)
        credits_used  = queue_info.get("credits_deducted", 0)
        print(f"  Complete — {rows_uploaded:,} rows | {credits_used:,} credits used")

        if not download_url:
            print(f"  No download URL")
            continue

        # Download results CSV
        print(f"  Downloading results...")
        result_rows = download_csv(download_url)

        # Filter to rows with email
        with_email = [r for r in result_rows if r.get("email_1","").strip()]
        print(f"  {len(with_email):,}/{len(result_rows):,} have email ({100*len(with_email)//max(len(result_rows),1)}% hit rate)")

        # Save locally
        out_path = OUT_DIR / f"results_{queue_id}_{today}.csv"
        if result_rows:
            with open(out_path, "w", newline="") as f:
                w = csv.DictWriter(f, fieldnames=list(result_rows[0].keys()))
                w.writeheader()
                w.writerows(result_rows)
            print(f"  Saved: {out_path.name}")

        if not with_email:
            print(f"  No email results to campaign")
            continue

        # Push to Supabase + send emails
        print(f"  Pushing to campaigns...")
        campaign_id, inserted = push_to_campaigns(with_email, campaign_name)

        if campaign_id and inserted > 0:
            print(f"  Sending emails...")
            sent = send_campaign_emails(campaign_id, campaign_name)
            grand_sent += sent
            print(f"  ✓ {sent} emails sent")

    print(f"\n{'='*55}")
    print(f"TOTAL EMAILS SENT: {grand_sent:,}")
    print(f"Check campaigns: https://thepropertydna.com/admin/campaigns")

if __name__ == "__main__":
    main()
