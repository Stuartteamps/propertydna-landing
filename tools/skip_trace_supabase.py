#!/usr/bin/env python3
"""
PropertyDNA — Supabase → Tracerfy Skip Trace Pipeline

Pulls all indexed properties from Supabase, formats for Tracerfy,
submits, fetches results, and saves campaign-ready CSVs.

Sources:
  FL counties  — property_history (source='fl_fdor_cadastral') → has owner name + mailing addr
  CA counties  — property_master → address-only skip trace (Tracerfy finds current owner)

Usage:
  SUPABASE_SERVICE_KEY=... TRACERFY_API_KEY=... python3 tools/skip_trace_supabase.py

  # FL only (absentee owners, highest value first):
  python3 tools/skip_trace_supabase.py --source fl --absentee-only --min-jv 250000

  # All CA indexed properties:
  python3 tools/skip_trace_supabase.py --source ca

  # Fetch already-submitted results (don't re-submit):
  python3 tools/skip_trace_supabase.py --fetch-only --queue-ids 84900,84901
"""

import os, sys, csv, io, json, time, requests, argparse
from pathlib import Path
from datetime import datetime

SUPABASE_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
TRACERFY_KEY = os.environ.get("TRACERFY_API_KEY", "")
TRACERFY_BASE = "https://tracerfy.com/v1/api"

OUT_DIR = Path(__file__).parent / "gmail-cleanup" / "contacts" / "fl_skiptraced"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BATCH_SIZE = 500  # Tracerfy batch size

# ── Supabase helpers ──────────────────────────────────────────────────────────

def supa_get(path, params=None):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
        params=params, timeout=30,
    )
    r.raise_for_status()
    return r.json()

# ── Pull FL owner data from property_history ──────────────────────────────────

def pull_fl_owners(co_nos=None, absentee_only=False, min_jv=0, limit=50000):
    """
    Pulls FL parcels from property_history where source='fl_fdor_cadastral'.
    Returns list of dicts with owner info + property address.
    """
    print(f"Pulling FL owner data from Supabase...")

    # Supabase doesn't support JSONB filtering easily via REST — pull in chunks
    # Filter by county_fips if co_nos specified
    filters = "source=eq.fl_fdor_cadastral&event_type=eq.assessment"
    if co_nos:
        fips_list = ",".join(f"12_{c}" for c in co_nos)
        # Join with property_master to filter by county_fips
        # Use a simpler approach: pull all FL and filter locally

    records = []
    offset = 0
    chunk = 1000
    while len(records) < limit:
        params = {
            "source": "eq.fl_fdor_cadastral",
            "event_type": "eq.assessment",
            "select": "apn,data",
            "order": "created_at.desc",
            "offset": str(offset),
            "limit": str(chunk),
        }
        batch = supa_get("property_history", params)
        if not batch:
            break

        for row in batch:
            d = row.get("data") or {}

            # Filter by county if specified
            if co_nos:
                # CO_NO stored in ownerZip? No — we need another way.
                # Actually county_fips is in property_master.
                # For now, skip this filter and let --counties flag handle it at query time.
                pass

            jv = float(d.get("justValue") or d.get("totalValue") or 0)
            if jv < min_jv:
                continue

            owner_name = str(d.get("ownerName") or "").strip()
            owner_state = str(d.get("ownerState") or "").strip().upper()

            if absentee_only and owner_state in ("FL", ""):
                continue
            if not owner_name or len(owner_name) < 3:
                continue

            # Skip entities
            skip_words = ["LLC", "INC", "CORP", "TRUST", "ESTATE", "ASSOCIATION", "HOA",
                         "BANK", "FUND", "INVEST", "PARTNER", "REALTY", "GROUP", "HOLDINGS"]
            if any(w in owner_name.upper() for w in skip_words):
                continue

            first, last = parse_owner_name(owner_name)

            records.append({
                "apn": row.get("apn"),
                "firstName": first,
                "lastName": last,
                "fullOwnerName": owner_name,
                "address": str(d.get("address") or "").strip(),
                "city": str(d.get("city") or "").strip(),
                "state": "FL",
                "zip": str(d.get("zip") or "").strip(),
                "mailAddress": str(d.get("ownerAddr") or d.get("address") or "").strip(),
                "mailCity": str(d.get("ownerCity") or d.get("city") or "").strip(),
                "mailState": owner_state or "FL",
                "mailZip": str(d.get("ownerZip") or d.get("zip") or "").strip(),
                "justValue": jv,
                "ownerState": owner_state,
                "absentee": owner_state not in ("FL", ""),
                "source": "fl_fdor_cadastral",
            })

        offset += len(batch)
        print(f"  Pulled {len(records)} valid FL owners so far ({offset} checked)")
        if len(batch) < chunk:
            break

    print(f"  Total FL records: {len(records)}")
    return records

# ── Pull CA address-only data from property_master ────────────────────────────

def pull_ca_properties(states=("CA",), limit=20000):
    """
    Pulls property_master records for CA counties (address-only skip trace).
    """
    print(f"Pulling CA property addresses from Supabase...")
    records = []
    offset = 0
    chunk = 1000

    for state in states:
        state_offset = 0
        while len(records) < limit:
            params = {
                "state": f"eq.{state}",
                "select": "apn,address,city,state,zip,county_fips",
                "address": "not.is.null",
                "order": "apn.asc",
                "offset": str(state_offset),
                "limit": str(chunk),
            }
            batch = supa_get("property_master", params)
            if not batch:
                break
            for row in batch:
                if not row.get("address"):
                    continue
                records.append({
                    "apn": row.get("apn"),
                    "firstName": "",
                    "lastName": "",
                    "address": str(row.get("address") or "").strip(),
                    "city": str(row.get("city") or "").strip(),
                    "state": state,
                    "zip": str(row.get("zip") or "").strip(),
                    "mailAddress": str(row.get("address") or "").strip(),
                    "mailCity": str(row.get("city") or "").strip(),
                    "mailState": state,
                    "mailZip": str(row.get("zip") or "").strip(),
                    "source": f"property_master_{row.get('county_fips', 'ca')}",
                })
            state_offset += len(batch)
            print(f"  {state}: {state_offset} pulled")
            if len(batch) < chunk:
                break

    print(f"  Total CA records: {len(records)}")
    return records

# ── Owner name parser ─────────────────────────────────────────────────────────
# FDOR stores names as "LASTNAME FIRSTNAME" or "LASTNAME FIRSTNAME MIDDLENAME"

def parse_owner_name(full_name):
    name = full_name.strip().upper()
    # Handle joint ownership: "SMITH JOHN & JANE" or "SMITH JOHN AND MARY"
    for sep in [" & ", " AND "]:
        if sep in name:
            name = name.split(sep)[0].strip()
            break
    parts = name.split()
    if len(parts) == 1:
        return "", parts[0].title()
    if len(parts) == 2:
        return parts[1].title(), parts[0].title()
    # 3+ parts: first word is last name, rest is first name (FDOR convention)
    return " ".join(parts[1:]).title(), parts[0].title()

# ── Tracerfy submission ───────────────────────────────────────────────────────

def build_tracerfy_csv(records):
    buf = io.StringIO()
    fieldnames = ["first_name","last_name","address","city","state","zip",
                  "mail_address","mail_city","mail_state","mail_zip"]
    w = csv.DictWriter(buf, fieldnames=fieldnames)
    w.writeheader()
    for r in records:
        w.writerow({
            "first_name": r.get("firstName",""),
            "last_name":  r.get("lastName",""),
            "address":    r.get("address",""),
            "city":       r.get("city",""),
            "state":      r.get("state",""),
            "zip":        r.get("zip",""),
            "mail_address": r.get("mailAddress",""),
            "mail_city":    r.get("mailCity",""),
            "mail_state":   r.get("mailState",""),
            "mail_zip":     r.get("mailZip",""),
        })
    return buf.getvalue()

def submit_batch(csv_content, label):
    r = requests.post(
        f"{TRACERFY_BASE}/trace/",
        headers={"Authorization": f"Bearer {TRACERFY_KEY}"},
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
        print(f"  ERROR: {r.status_code} {r.text[:200]}")
        return None
    data = r.json()
    queue_id = data.get("id") or data.get("queue_id")
    print(f"  Submitted {label} → queue {queue_id}")
    return queue_id

def fetch_results(queue_id, label, max_wait=600, interval=20):
    deadline = time.time() + max_wait
    while time.time() < deadline:
        r = requests.get(f"{TRACERFY_BASE}/queue/{queue_id}",
                         headers={"Authorization": f"Bearer {TRACERFY_KEY}"}, timeout=30)
        if r.status_code != 200:
            print(f"  Poll error {queue_id}: {r.status_code}")
            time.sleep(interval)
            continue
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            return data
        print(f"  [{label}] waiting... ({type(data).__name__})")
        time.sleep(interval)
    print(f"  [{label}] timed out after {max_wait}s")
    return []

# ── Result merger ─────────────────────────────────────────────────────────────

def merge_results(originals, results):
    idx = {}
    for r in results:
        addr = (r.get("address") or "").strip().lower()
        if addr:
            idx[addr] = r

    enriched = []
    matched = 0
    for orig in originals:
        key = orig.get("address","").strip().lower()
        res = idx.get(key)
        row = dict(orig)
        if res:
            matched += 1
            phones = [res.get(f"mobile_{i}") or res.get(f"phone_{i}") or "" for i in range(1,4)]
            phone = next((p for p in phones if p), "")
            emails = [res.get(f"email_{i}","") for i in range(1,6) if res.get(f"email_{i}")]
            email = emails[0] if emails else ""
            if phone and not row.get("phone"): row["phone"] = phone
            if email and not row.get("email"): row["email"] = email
            if not row.get("firstName") and res.get("first_name"):
                row["firstName"] = res["first_name"]
            if not row.get("lastName") and res.get("last_name"):
                row["lastName"] = res["last_name"]
        enriched.append(row)
    return enriched, matched

# ── CSV export ────────────────────────────────────────────────────────────────

def save_campaign_csv(path, records):
    fieldnames = ["firstName","lastName","email","phone","address","city","state","zip",
                  "mailState","absentee","justValue","source","apn"]
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(records)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["fl","ca","all"], default="fl")
    parser.add_argument("--absentee-only", action="store_true")
    parser.add_argument("--min-jv", type=float, default=0)
    parser.add_argument("--limit", type=int, default=50000)
    parser.add_argument("--fetch-only", action="store_true")
    parser.add_argument("--queue-ids", help="Comma-separated queue IDs for --fetch-only")
    args = parser.parse_args()

    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY not set"); sys.exit(1)
    if not TRACERFY_KEY:
        print("ERROR: TRACERFY_API_KEY not set"); sys.exit(1)

    all_records = []

    if not args.fetch_only:
        if args.source in ("fl","all"):
            fl = pull_fl_owners(
                absentee_only=args.absentee_only,
                min_jv=args.min_jv,
                limit=args.limit,
            )
            all_records.extend(fl)

        if args.source in ("ca","all"):
            ca = pull_ca_properties()
            all_records.extend(ca)

        if not all_records:
            print("No records found."); sys.exit(0)

        print(f"\nTotal records to skip-trace: {len(all_records):,}")
        print(f"Estimated Tracerfy cost: ~${len(all_records) * 0.02:,.2f}")

        # Split into BATCH_SIZE batches
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        batches = [all_records[i:i+BATCH_SIZE] for i in range(0, len(all_records), BATCH_SIZE)]
        jobs = []

        for i, batch in enumerate(batches):
            label = f"pdna_{args.source}_{timestamp}_batch{i+1:03d}"
            csv_content = build_tracerfy_csv(batch)
            queue_id = submit_batch(csv_content, label)
            if queue_id:
                jobs.append((label, queue_id, batch))
            time.sleep(2)

        print(f"\nSubmitted {len(jobs)} batches. Fetching results...\n")
    else:
        # --fetch-only with explicit queue IDs
        if not args.queue_ids:
            print("--fetch-only requires --queue-ids"); sys.exit(1)
        jobs = [(f"queue_{qid}", int(qid), []) for qid in args.queue_ids.split(",")]

    # Fetch and merge results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    total_matched = 0
    total_with_email = 0
    total_with_phone = 0
    all_enriched = []

    for label, queue_id, originals in jobs:
        print(f"Fetching {label} (queue {queue_id})...")
        results = fetch_results(queue_id, label)
        if not results:
            print(f"  No results for {label}\n")
            continue
        enriched, matched = merge_results(originals, results)
        with_email = sum(1 for r in enriched if r.get("email"))
        with_phone = sum(1 for r in enriched if r.get("phone"))
        print(f"  {matched}/{len(originals)} matched | {with_email} emails | {with_phone} phones")
        total_matched += matched
        total_with_email += with_email
        total_with_phone += with_phone
        all_enriched.extend(enriched)

    if all_enriched:
        # Sort by absentee + justValue (best leads first)
        all_enriched.sort(key=lambda r: (
            -int(r.get("absentee") or 0),
            -float(r.get("justValue") or 0),
        ))
        # Split into email-having vs all
        with_contact = [r for r in all_enriched if r.get("email") or r.get("phone")]
        out_path = OUT_DIR / f"skip_traced_{args.source}_{timestamp}.csv"
        save_campaign_csv(out_path, all_enriched)
        contact_path = OUT_DIR / f"skip_traced_{args.source}_{timestamp}_contacts_only.csv"
        save_campaign_csv(contact_path, with_contact)
        print(f"\nSaved {len(all_enriched)} records → {out_path.name}")
        print(f"Saved {len(with_contact)} with contact info → {contact_path.name}")

    print(f"\n{'='*60}")
    print(f"DONE: {total_matched} matched | {total_with_email} emails | {total_with_phone} phones")
    print(f"Upload CSV at: /admin/campaigns → Import Contacts")
    print(f"Output dir: {OUT_DIR}")

if __name__ == "__main__":
    main()
