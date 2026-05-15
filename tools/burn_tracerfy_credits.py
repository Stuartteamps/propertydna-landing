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
    """
    Two-step indexed query (works without view):
    1. Pull top N property_master records by tax_assessed_value (indexed)
    2. Pull matching property_history rows by APN (indexed) for owner info
    """
    # Attempt the view first (if migration 017 applied)
    url = (f"{SUPA_URL}/rest/v1/v_skip_trace_priority"
           f"?priority_tier=lte.3&select=*&order=priority_tier.asc,market_value.desc"
           f"&limit={limit}")
    r = requests.get(url, headers=SUPA_HDR, timeout=30)
    if r.ok and r.json():
        return r.json(), "v_skip_trace_priority"

    print(f"  View unavailable, using indexed two-step query...")

    # Step 1: pull top property_master records by assessed value, PAGINATED
    # Supabase REST caps at 1000 per request — paginate to get deeper into the index
    pm_target = max(limit * 50, 10000)  # cast wide because most are entities
    pm_rows = []
    page = 0
    value_floor = int(os.environ.get("MIN_VALUE", "500000"))
    while len(pm_rows) < pm_target:
        url = (f"{SUPA_URL}/rest/v1/property_master"
               f"?tax_assessed_value=gte.{value_floor}"
               f"&select=apn,address,city,state,zip,tax_assessed_value"
               f"&order=tax_assessed_value.desc"
               f"&limit=1000&offset={page*1000}")
        r = requests.get(url, headers=SUPA_HDR, timeout=60)
        if not r.ok:
            print(f"  property_master query failed: {r.status_code} {r.text[:200]}")
            break
        batch = r.json()
        if not batch: break
        pm_rows.extend(batch)
        page += 1
        if page > 50: break  # safety cap at 50k records
    print(f"  Step 1: {len(pm_rows)} property_master records (>=$750k, paginated)")
    if not pm_rows:
        return [], None

    # Step 2: pull property_history for these APNs (indexed by apn)
    # Chunk into groups of 50 to keep URLs short
    apn_to_pm = {p["apn"]: p for p in pm_rows}
    apns = list(apn_to_pm.keys())
    history_by_apn = {}
    for i in range(0, len(apns), 50):
        chunk = apns[i:i+50]
        apn_filter = ",".join(f'"{a}"' for a in chunk)
        url = (f"{SUPA_URL}/rest/v1/property_history"
               f"?apn=in.({apn_filter})&select=apn,data&limit={len(chunk)}")
        r2 = requests.get(url, headers=SUPA_HDR, timeout=30)
        if r2.ok:
            for row in r2.json():
                # Keep most recent per APN (first one wins since we don't sort)
                if row["apn"] not in history_by_apn:
                    history_by_apn[row["apn"]] = row.get("data") or {}
    print(f"  Step 2: {len(history_by_apn)} property_history matches")

    # Entity owner patterns to exclude (Tracerfy can't skip-trace LLCs)
    import re
    ENTITY_PATTERNS = re.compile(
        r'\b(LLC|L\.L\.C\.|INC|INC\.|CORP|CORP\.|CO\.|COMPANY|LP|L\.P\.|LTD|LIMITED|'
        r'PARTNERSHIP|TRUST|TRUSTEE|ESTATE|ESTATES|FUND|HOLDINGS|HLDG|HOLDING|'
        r'PROPERTIES|REALTY|GROUP|ASSOC|ASSOCIATION|FOUNDATION|CHURCH|HOA|'
        r'BANK|MORTGAGE|INVEST|VENTURES|CAPITAL|ENTERPRISES|DEVELOPMENT|DEVELOP|'
        r'CITY OF|TOWN OF|COUNTY OF|STATE OF|USA|UNITED STATES|GOVERNMENT|MUNICIPAL|'
        r'UNIVERSITY|COLLEGE|SCHOOL|ACADEMY|HOSPITAL|MEDICAL|CONVENT|MONASTERY|'
        r'DIOCESE|PARISH|ROMAN CATHOLIC|EPISCOPAL|METHODIST|JEWISH|TEMPLE|SYNAGOGUE|'
        r'ASSOCIATION|SOCIETY|CLUB|UTILITIES|RAILROAD|RAILWAY|TRANSIT|AUTHORITY|'
        r'DISTRICT|DEPARTMENT|DEPT|MUSEUM|LIBRARY|YMCA|YWCA|REDEVELOPMENT)\b',
        re.IGNORECASE,
    )

    # Merge + filter to absentee priority + individuals only
    records = []
    skipped_entities = 0
    for apn, pm in apn_to_pm.items():
        d = history_by_apn.get(apn, {})
        owner_name = d.get("ownerName") or ""
        if not owner_name or len(owner_name) < 3:
            continue
        # Skip entity owners — Tracerfy returns no useful contact for LLCs
        if ENTITY_PATTERNS.search(owner_name):
            skipped_entities += 1
            continue
        mailing_state = (d.get("ownerState") or d.get("mailingState") or "").strip().upper()
        property_state = (pm.get("state") or "").strip().upper()
        is_absentee = bool(d.get("absentee")) or (mailing_state and mailing_state != property_state)
        # ABSENTEE_ONLY=1 to filter, default = include owner-occupied luxury too
        if os.environ.get("ABSENTEE_ONLY") == "1" and not is_absentee:
            continue

        records.append({
            "apn": apn,
            "owner_name": owner_name,
            "address": pm.get("address"),
            "city": pm.get("city"),
            "state": pm.get("state"),
            "zip": pm.get("zip"),
            "mailing_addr": d.get("ownerAddr") or d.get("mailingAddr") or pm.get("address"),
            "mailing_city": d.get("ownerCity") or d.get("mailingCity") or pm.get("city"),
            "mailing_state": mailing_state or property_state,
            "mailing_zip": d.get("ownerZip") or d.get("mailingZip") or pm.get("zip"),
            "market_value": pm.get("tax_assessed_value"),
            "absentee": is_absentee,
        })
        if len(records) >= limit: break

    # De-dupe against already-traced APNs from prior burns
    already_traced = set()
    try:
        prior_dir = Path("tools/gmail-cleanup/contacts/burn_tracerfy")
        for jf in prior_dir.glob("*_records.json"):
            for r in json.loads(jf.read_text()):
                if r.get("apn"): already_traced.add(r["apn"])
    except Exception:
        pass
    if already_traced:
        before = len(records)
        records = [r for r in records if r.get("apn") not in already_traced]
        print(f"  De-dup: removed {before-len(records)} previously-traced APNs")

    print(f"  Step 3: {len(records)} new individual absentee owners (skipped {skipped_entities} entities)")
    return records, "indexed two-step query (paginated)"

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
