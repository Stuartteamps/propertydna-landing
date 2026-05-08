#!/usr/bin/env python3
"""
Google Postmaster Tools daily reputation monitor.

Pulls domain reputation, spam rate, and authentication stats for
both sending domains and logs results to Supabase.

One-time setup (run once in browser):
  gcloud auth application-default login \
    --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/postmaster.readonly"

Then schedule daily via cron or run manually:
  python3 tools/postmaster_monitor.py

Domains monitored:
  - thepropertydna.com      (transactional — reports, confirmations)
  - mail.thepropertydna.com (campaigns — blasts, drip, outreach)

Supabase table: postmaster_daily (auto-created on first run if migration applied)
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import requests

DOMAINS = [
    "thepropertydna.com",
    "mail.thepropertydna.com",
]

SUPA_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPA_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT",
)
SUPA_HEADERS = {
    "apikey": SUPA_KEY,
    "Authorization": f"Bearer {SUPA_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=representation",
}

API_BASE = "https://gmailpostmastertools.googleapis.com/v1"

REPUTATION_MAP = {
    "HIGH": 4,
    "MEDIUM": 3,
    "LOW": 2,
    "BAD": 1,
    "REPUTATION_CATEGORY_UNSPECIFIED": None,
}


def get_access_token() -> str:
    """Get OAuth token with postmaster scope via gcloud ADC."""
    try:
        result = subprocess.run(
            ["gcloud", "auth", "application-default", "print-access-token"],
            capture_output=True, text=True, check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        print("ERROR: No valid credentials. Run:")
        print(
            '  gcloud auth application-default login \\\n'
            '    --scopes="https://www.googleapis.com/auth/cloud-platform,'
            'https://www.googleapis.com/auth/postmaster.readonly"'
        )
        sys.exit(1)


def fetch_traffic_stats(token: str, domain: str, date_str: str) -> dict | None:
    """Fetch traffic stats for a domain on a given date (YYYY/MM/DD)."""
    name = f"domains/{domain}/trafficStats/{date_str.replace('-', '/')}"
    r = requests.get(
        f"{API_BASE}/{name}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    if r.status_code == 404:
        return None  # No data for this date yet
    if r.status_code != 200:
        print(f"  [{domain}] API error {r.status_code}: {r.text[:200]}")
        return None
    return r.json()


def parse_stats(domain: str, date: str, data: dict) -> dict:
    """Extract key metrics from raw Postmaster API response."""
    domain_rep = data.get("domainReputation", "REPUTATION_CATEGORY_UNSPECIFIED")
    ip_rep     = data.get("ipReputations", [])
    spam_rate  = data.get("userReportedSpamRatio")
    dkim_rate  = data.get("dkimSuccessRatio")
    spf_rate   = data.get("spfSuccessRatio")
    dmarc_rate = data.get("dmarcSuccessRatio")

    # Lowest IP reputation across all IPs
    worst_ip_rep = None
    if ip_rep:
        rep_scores = [REPUTATION_MAP.get(i.get("reputation", ""), None) for i in ip_rep]
        rep_scores = [s for s in rep_scores if s is not None]
        worst_ip_rep = min(rep_scores) if rep_scores else None

    return {
        "domain":          domain,
        "date":            date,
        "domain_rep":      domain_rep,
        "domain_rep_score": REPUTATION_MAP.get(domain_rep),
        "worst_ip_rep_score": worst_ip_rep,
        "spam_rate":       spam_rate,
        "dkim_pass_rate":  dkim_rate,
        "spf_pass_rate":   spf_rate,
        "dmarc_pass_rate": dmarc_rate,
        "raw":             json.dumps(data),
    }


def save_to_supabase(row: dict):
    """Upsert one day's stats row into Supabase."""
    r = requests.post(
        f"{SUPA_URL}/rest/v1/postmaster_daily",
        headers=SUPA_HEADERS,
        json=row,
        timeout=15,
    )
    if r.status_code not in (200, 201):
        print(f"  Supabase error {r.status_code}: {r.text[:200]}")


def alert_if_bad(row: dict):
    """Print a loud warning if reputation degrades or spam rate spikes."""
    domain = row["domain"]
    rep    = row["domain_rep"]
    spam   = row["spam_rate"]

    if rep in ("LOW", "BAD"):
        print(f"\n  ⚠️  ALERT [{domain}] Domain reputation: {rep}")
        print(f"     Action required — review recent campaign complaint rates\n")

    if spam is not None and spam > 0.001:  # >0.1% — Gmail's threshold
        pct = spam * 100
        print(f"\n  ⚠️  ALERT [{domain}] Spam rate: {pct:.3f}% (threshold: 0.1%)")
        print(f"     Pause campaigns and audit list quality immediately\n")


def run(days_back: int = 2):
    """Pull stats for yesterday (Postmaster data is ~1 day delayed)."""
    token = get_access_token()
    today = datetime.now(timezone.utc).date()

    print(f"PropertyDNA — Postmaster Monitor — {today}\n")

    for domain in DOMAINS:
        print(f"Domain: {domain}")
        found = False

        for offset in range(1, days_back + 3):  # Try last few days (data lags)
            check_date = today - timedelta(days=offset)
            date_str = check_date.strftime("%Y-%m-%d")
            data = fetch_traffic_stats(token, domain, date_str)

            if data:
                row = parse_stats(domain, date_str, data)
                save_to_supabase(row)
                alert_if_bad(row)

                rep   = row["domain_rep"]
                spam  = f"{row['spam_rate']*100:.4f}%" if row["spam_rate"] else "n/a"
                dkim  = f"{row['dkim_pass_rate']*100:.1f}%" if row["dkim_pass_rate"] else "n/a"
                dmarc = f"{row['dmarc_pass_rate']*100:.1f}%" if row["dmarc_pass_rate"] else "n/a"

                print(f"  Date: {date_str}")
                print(f"  Reputation:  {rep}")
                print(f"  Spam rate:   {spam}")
                print(f"  DKIM pass:   {dkim}")
                print(f"  DMARC pass:  {dmarc}")
                print()
                found = True
                break

        if not found:
            print(f"  No data yet (domain may need 24-48h after first sends)\n")


if __name__ == "__main__":
    run()
