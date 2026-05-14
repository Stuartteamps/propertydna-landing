#!/usr/bin/env python3
"""
Max out remaining Tracerfy credits (~130 left) on the absolute top-priority records.

Pulls the highest-priority skip-trace targets from v_skip_trace_priority view
(requires migration 017_skip_trace_priority_view.sql to be applied first).

If view isn't applied yet, falls back to a direct query for absentee + $1M+ records.

Usage:
  python3 tools/burn_tracerfy_credits.py
  python3 tools/burn_tracerfy_credits.py --max 120     # leave 10 for safety
  python3 tools/burn_tracerfy_credits.py --check       # just show balance, don't submit
"""

import os, csv, io, json, time, requests, argparse, sys
from pathlib import Path

TKEY = os.environ.get("TRACERFY_API_KEY") or sys.exit("ERROR: Set TRACERFY_API_KEY env var")
TBASE  = "https://tracerfy.com/v1/api"
THDR   = {"Authorization": f"Bearer {TKEY}"}

SUPA_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPA_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or sys.exit("ERROR: Set SUPABASE_SERVICE_KEY env var")
SUPA_HDR = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}

OUT_DIR = Path("tools/gmail-cleanup/contacts/burn_tracerfy")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def check_balance():
    r = requests.get(f"{TBASE}/analytics/", headers=THDR, timeout=15)
    return r.json() if r.ok else {"balance": 0, "error": r.text[:200]}

def fetch_top_priority(limit):
    """Try the priority view first, fall back to raw query."""
    # Attempt 1: view (requires migration 017)
    url = (f"{SUPA_URL}/rest/v1/v_skip_trace_priority"
           f"?priority_tier=lte.3&select=*&order=priority_tier.asc,market_value.desc"
           f"&limit={limit}")
    r = requests.get(url, headers=SUPA_HDR, timeout=120)
    if r.ok:
        return r.json(), "v_skip_trace_priority"
    print(f"  View not available ({r.status_code}), falling back to direct query")

    # Fallback: query property_history JSONB directly for $1M+ absentee
    url = (f"{SUPA_URL}/rest/v1/property_history"
           f"?data->>justValue=gte.1000000"
           f"&data->>absentee=eq.true"
           f"&select=apn,data"
           f"&limit={limit}")
    r = requests.get(url, headers=SUPA_HDR, timeout=120)
    if r.ok:
        rows = r.json()
        return [_flatten(x) for x in rows], "property_history (fallback)"

    print(f"  Both queries failed. Status: {r.status_code}, {r.text[:200]}")
    return [], None

def _flatten(row):
    """Flatten property_history JSONB into priority-view-like dict."""
    d = row.get("data") or {}
    return {
        "apn": row.get("apn"),
        "owner_name": d.get("ownerName"),
        "address": d.get("address"),
        "city": d.get("city"),
        "state": d.get("state") or d.get("ownerState"),
        "zip": d.get("zip"),
        "mailing_addr": d.get("ownerAddr") or d.get("mailingAddr"),
        "mailing_city": d.get("ownerCity") or d.get("mailingCity"),
        "mailing_state": d.get("ownerState") or d.get("mailingState"),
        "mailing_zip": d.get("ownerZip") or d.get("mailingZip"),
        "market_value": d.get("justValue") or d.get("marketValue") or d.get("assessedTotal"),
    }

def parse_name(full):
    """FDOR/CT style: LAST FIRST. Returns (first, last)."""
    parts = (full or "").strip().upper().split()
    if len(parts) == 0: return "", ""
    if len(parts) == 1: return "", parts[0].title()
    # Join AND owners — keep only first owner
    for sep in [" AND ", " & "]:
        if sep in " ".join(parts):
            parts = " ".join(parts).split(sep)[0].split()
    return " ".join(parts[1:]).title(), parts[0].title()

def build_csv(records):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=[
        "first_name","last_name","address","city","state","zip",
        "mail_address","mail_city","mail_state","mail_zip"])
    w.writeheader()
    for r in records:
        first, last = parse_name(r.get("owner_name") or "")
        w.writerow({
            "first_name": first, "last_name": last,
            "address": r.get("address") or "", "city": r.get("city") or "",
            "state": r.get("state") or "", "zip": (r.get("zip") or "")[:5],
            "mail_address": r.get("mailing_addr") or r.get("address") or "",
            "mail_city":    r.get("mailing_city") or r.get("city") or "",
            "mail_state":   r.get("mailing_state") or r.get("state") or "",
            "mail_zip":     (r.get("mailing_zip") or r.get("zip") or "")[:5],
        })
    return buf.getvalue()

def submit(csv_content, label):
    r = requests.post(
        f"{TBASE}/trace/",
        headers=THDR,
        data={
            "trace_type": "normal",
            "first_name_column": "first_name", "last_name_column": "last_name",
            "address_column": "address", "city_column": "city",
            "state_column": "state", "zip_column": "zip",
            "mail_address_column": "mail_address", "mail_city_column": "mail_city",
            "mail_state_column": "mail_state", "mail_zip_column": "mail_zip",
        },
        files={"csv_file": (f"{label}.csv", csv_content.encode(), "text/csv")},
        timeout=60,
    )
    if r.status_code not in (200, 201):
        print(f"  Submit error {r.status_code}: {r.text[:300]}")
        return None
    return r.json().get("id") or r.json().get("queue_id")

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--max", type=int, default=125, help="Max credits to spend (leave a buffer)")
    p.add_argument("--check", action="store_true")
    args = p.parse_args()

    bal = check_balance()
    print(f"Tracerfy account:")
    print(f"  Balance: {bal.get('balance', 0)} credits")
    print(f"  Properties traced previously: {bal.get('properties_traced', 0)}")
    print(f"  Queues completed: {bal.get('queues_completed', 0)}")

    if args.check:
        return

    available = bal.get("balance", 0)
    target = min(args.max, available)
    if target <= 0:
        print(f"\nNo credits available. Top up at https://tracerfy.com")
        return

    print(f"\nPulling top {target} priority records from Supabase...")
    records, source = fetch_top_priority(target)
    if not records:
        print("No records returned. Verify migration 017 is applied OR property_history has owner data.")
        return

    print(f"  Got {len(records)} records from: {source}")
    for r in records[:5]:
        print(f"    {r.get('owner_name','?'):30} | ${r.get('market_value',0):>12,.0f} | {r.get('city','?')}, {r.get('state','?')}")

    # Save the source CSV (we'll use it later to merge results)
    timestamp = time.strftime("%Y%m%d_%H%M")
    src_path = OUT_DIR / f"burn_t1_t3_{timestamp}_source.csv"
    csv_content = build_csv(records)
    src_path.write_text(csv_content)
    print(f"\n  Source CSV: {src_path.name}")

    # Save full records for later merge
    json_path = OUT_DIR / f"burn_t1_t3_{timestamp}_records.json"
    json_path.write_text(json.dumps(records, default=str, indent=2))

    print(f"\nSubmitting to Tracerfy...")
    label = f"burn_t1_t3_{timestamp}"
    queue_id = submit(csv_content, label)
    if queue_id:
        print(f"  ✓ Submitted queue {queue_id} ({len(records)} records)")
        print(f"\nNext step: poll for results with")
        print(f"  python3 tools/fetch_skiptrace_results.py --queue-ids {queue_id}")
    else:
        print(f"  ✗ Submission failed")

    bal_after = check_balance()
    print(f"\nRemaining balance: {bal_after.get('balance', 0)} credits")

if __name__ == "__main__":
    main()
